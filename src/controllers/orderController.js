import bcrypt from "bcryptjs";
import { redisClient } from "../config/redis.js";

import Order from "../models/Order.js";
import Menu from "../models/Menu.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Notification from "../models/Notification.js";
import Settings from "../models/Settings.js";
import { getIo } from "../config/socket.js";

import razorpay from "../config/razorpay.js";
import crypto from "crypto";

const generatePickupCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const cartKey = `cart:${userId}`;
    const paymentMethod = req.body.paymentMethod; // "wallet" or "razorpay"

    // Check if Canteen is Open
    const settings = await Settings.findOne();
    if (settings && settings.isOpen === false) {
      res.status(403);
      throw new Error("Canteen is currently closed. Cannot place new orders.");
    }

    if (!paymentMethod || !["wallet", "razorpay"].includes(paymentMethod)) {
      res.status(400);
      throw new Error("Invalid payment method. Use 'wallet' or 'razorpay'.");
    }
    
    // Check existing order first to prevent duplicate active loops
    const existingOrder = await Order.findOne({
      user: userId,
      status: { $in: ["pending", "paid", "preparing", "ready"] },
    });
    if (existingOrder) {
      res.status(400);
      throw new Error("You already have an active order");
    }

    let inputItems = req.body.items || [];
    
    // Fallback to Redis if req.body.items is omitted
    if (!inputItems || inputItems.length === 0) {
        const cartItems = await redisClient.hGetAll(cartKey);
        if (Object.keys(cartItems).length === 0) {
          res.status(400);
          throw new Error("Cart is empty");
        }
        inputItems = Object.keys(cartItems).map(id => ({ _id: id, quantity: Number(cartItems[id]) }));
    }

    // Security: limit cart size and quantity
    if (inputItems.length > 20) {
      res.status(400);
      throw new Error("Too many items. Max 20 different items per order.");
    }
    for (const item of inputItems) {
      const q = Number(item.quantity);
      if (!q || q <= 0 || q > 10 || !Number.isInteger(q)) {
        res.status(400);
        throw new Error("Invalid quantity. Each item must be 1-10.");
      }
    }

    const menuIds = inputItems.map(i => i._id);
    const menuItems = await Menu.find({ _id: { $in: menuIds } });

    if (menuItems.length === 0) {
      res.status(400);
      throw new Error("No valid menu items found");
    }

    let orderItems = [];
    let totalAmount = 0;

    for (let item of menuItems) {
      const inputMatch = inputItems.find(i => i._id.toString() === item._id.toString());
      if (!inputMatch) continue;
      const quantity = Number(inputMatch.quantity);

      orderItems.push({
        menu: item._id,
        name: item.name,
        price: item.price,
        quantity,
      });

      totalAmount += item.price * quantity;
    }

    if (orderItems.length === 0 || totalAmount <= 0) {
      res.status(400);
      throw new Error("Order cannot be empty or zero");
    }

    const plainPickUpCode = generatePickupCode();
    const hashedPickUpCode = await bcrypt.hash(plainPickUpCode, 10);

    // ── WALLET PAYMENT ──
    if (paymentMethod === "wallet") {
      const user = await User.findById(userId);
      if (user.walletBalance < totalAmount) {
         res.status(400);
         throw new Error("Insufficient wallet balance. Please add money!");
      }
      user.walletBalance -= totalAmount;
      await user.save();

      await Transaction.create({
          userId,
          amount: totalAmount,
          type: "debit",
          description: `Order Placed (Wallet)`
      });

      const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount,
        status: "pending",
        paymentMethod: "wallet",
        isPaid: true,
        pickupCode: hashedPickUpCode,
        pickupCodePlain: plainPickUpCode,
      });

      await Notification.create({
         user: userId,
         title: "Order Placed",
         message: `Order #${order._id.toString().slice(-4).toUpperCase()} placed via Wallet.`,
         type: "order"
      });

      await redisClient.del(cartKey);

      const io = getIo();
      io.to("kitchen_room").emit("new_order", { orderId: order._id, totalAmount });
      io.to("admin_dashboard").emit("new_order", { orderId: order._id, totalAmount });

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        orderId: order._id,
        pickupCode: plainPickUpCode,
      });
    }

    // ── RAZORPAY PAYMENT ──
    if (paymentMethod === "razorpay") {
      // Create order in pending_payment state (not yet confirmed)
      const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount,
        status: "pending_payment",
        paymentMethod: "razorpay",
        isPaid: false,
        pickupCode: hashedPickUpCode,
        pickupCodePlain: plainPickUpCode,
      });

      await redisClient.del(cartKey);

      // Create Razorpay order
      if (!razorpay) {
        res.status(500);
        throw new Error("Payment gateway not configured. Contact admin.");
      }

      const razorpayOrder = await razorpay.orders.create({
        amount: totalAmount * 100, // paise
        currency: "INR",
        receipt: order._id.toString(),
      });

      order.razorpayOrderId = razorpayOrder.id;
      await order.save();

      return res.status(201).json({
        success: true,
        message: "Razorpay order created. Complete payment.",
        orderId: order._id,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        amount: totalAmount * 100,
        pickupCode: plainPickUpCode,
      });
    }

  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Validate status transitions
    const validTransitions = {
      pending: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["completed", "cancelled"],
    };
    const allowed = validTransitions[order.status];
    if (!allowed || !allowed.includes(status)) {
      res.status(400);
      throw new Error(`Cannot move from '${order.status}' to '${status}'`);
    }

    order.status = status;
    await order.save();

    // Include pickup code in ready notification
    let notifMessage = `Order #${order._id.toString().slice(-4).toUpperCase()} is now ${status}.`;
    if (status === "ready" && order.pickupCodePlain) {
       notifMessage = `Order #${order._id.toString().slice(-4).toUpperCase()} is ready! Pickup Code: ${order.pickupCodePlain}`;
    }

    await Notification.create({
       user: order.user,
       title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
       message: notifMessage,
       type: "order"
    });

    const io = getIo();

    io.to(`user_${order.user}`).emit("order_status_updated", {
      orderId: order._id,
      status: order.status,
      pickupCodePlain: order.pickupCodePlain || null,
    });

    io.to("admin_dashboard").emit("order_status_updated", {
      orderId: order._id,
      status: order.status,
    });

    res.json({
      success: true,
      message: "order status updated",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPickUpCode = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { pickupCode } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404);
      throw new Error("order not found");
    }

    if (order.status !== "ready") {
      res.status(400);
      throw new Error("Order is not ready for pickup");
    }

    const isMatch = await bcrypt.compare(pickupCode, order.pickupCode);

    if (!isMatch) {
      res.status(400);
      throw new Error("Invalid pickup code");
    }

    order.status = "completed";
    await order.save();

    res.json({
      success: true,
      message: "Order completed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    console.log("getMyOrders called for user:", req.user?._id);

    const orders = await Order.find({
      user: req.user._id,
    })
      .select("-pickupCode")
      .sort({ createdAt: -1 });

    console.log("Found orders:", orders.length);

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("getMyOrders error:", error);
    next(error);
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

export const createPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new Error("order not found");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("order not found");
    }

    if (order.isPaid) {
      throw new Error("already paid for this item");
    }

    const options = {
      amount: order.totalAmount * 100,
      currency: "INR",
      receipt: order._id.toString(),
    };

    const razorPayOrder = await razorpay.orders.create(options);

    order.razorpayOrderId = razorPayOrder.id;

    res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      key: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
    });

    await order.save();
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      res.status(400);
      throw new Error("Payment verification failed");
    }

    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (order.isPaid) {
      return res.json({
        success: true,
        message: "Payment already verified",
      });
    }

    order.isPaid = true;
    order.status = "pending";
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    await Transaction.create({
        userId: order.user,
        amount: order.totalAmount,
        type: "debit",
        description: `Order Placed (Razorpay)`
    });

    await Notification.create({
       user: order.user,
       title: "Payment Successful",
       message: `Order #${order._id.toString().slice(-4).toUpperCase()} paid via Razorpay.`,
       type: "order"
    });

    const io = getIo();

    io.to(`user_${order.user}`).emit("payment_success", {
      orderId: order._id,
    });

    io.to("kitchen_room").emit("new_order", { orderId: order._id, totalAmount: order.totalAmount });
    io.to("admin_dashboard").emit("new_order", { orderId: order._id, totalAmount: order.totalAmount });

    res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueByDay = async (req, res, next) => {
  try {
    const revenue = await Order.aggregate([
      {
        $match: { status: "completed" },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    return res.json({
      success: true,
      data: revenue,
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueByMonth = async (req, res, next) => {
  try {
    const revenue = await Order.aggregate([
      {
        $match: { status: "completed" },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    return res.json({
      success: true,
      data: revenue,
    });
  } catch (error) {
    next(error);
  }
};

export const getTopSellingItems = async (req, res, next) => {
  try {
    const items = await Order.aggregate([
      { $match: { status: "completed" } },
      { $unwind: "$items" },

      {
        $group: {
          _id: "$items.name",
          totalSold: { $sum: "$items.quantity" },
          revenue: {
            $sum: {
              $multiply: ["$items.price", "$items.quantity"],
            },
          },
        },
      },

      { $sort: { totalSold: -1 } },

      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderStatusSummary = async (req, res, next) => {
  try {
    const summary = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};
