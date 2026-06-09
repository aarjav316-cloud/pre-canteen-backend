import bcrypt from "bcryptjs";
import { redisClient } from "../config/redis.js";
import logger from "../utils/logger.js";

import Order from "../models/Order.js";
import Menu from "../models/Menu.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Notification from "../models/Notification.js";
import Settings from "../models/Settings.js";
import { getIo } from "../config/socket.js";

import razorpay from "../config/razorpay.js";
import crypto from "crypto";
import mongoose from "mongoose";

const generatePickupCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const cartKey = `cart:${userId}`;
    const paymentMethod = req.body.paymentMethod; // "wallet" or "razorpay"

    const settings = await Settings.findOne();
    if (settings && settings.isOpen === false) {
      res.status(403);
      throw new Error("Canteen is currently closed. Cannot place new orders.");
    }

    if (
      !paymentMethod ||
      !["wallet", "razorpay", "counter"].includes(paymentMethod)
    ) {
      res.status(400);
      throw new Error(
        "Invalid payment method. Use 'wallet', 'razorpay', or 'counter'.",
      );
    }

    const existingOrder = await Order.findOne({
      user: userId,
      status: { $in: ["pending", "paid", "preparing", "ready"] },
    });
    if (existingOrder) {
      res.status(400);
      throw new Error("You already have an active order");
    }

    let inputItems = req.body.items || [];

    if (!inputItems || inputItems.length === 0) {
      const cartItems = await redisClient.hGetAll(cartKey);
      if (Object.keys(cartItems).length === 0) {
        res.status(400);
        throw new Error("Cart is empty");
      }
      inputItems = Object.keys(cartItems).map((id) => ({
        _id: id,
        quantity: Number(cartItems[id]),
      }));
    }

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

    const menuIds = inputItems.map((i) => i._id);

    // Validate that all incoming IDs are valid ObjectIds to prevent CastError crashes
    for (const id of menuIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error(
          "Cart contains invalid test items. Please clear your cart and add valid items from the menu.",
        );
      }
    }

    const menuItems = await Menu.find({ _id: { $in: menuIds } });

    if (menuItems.length === 0) {
      res.status(400);
      throw new Error("No valid menu items found");
    }

    let orderItems = [];
    let totalAmount = 0;

    for (let item of menuItems) {
      const inputMatch = inputItems.find(
        (i) => i._id.toString() === item._id.toString(),
      );
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
        description: `Order Placed (Wallet)`,
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
        type: "order",
      });

      await redisClient.del(cartKey);

      const io = getIo();
      io.to("kitchen_room").emit("new_order", {
        orderId: order._id,
        totalAmount,
      });
      io.to("admin_dashboard").emit("new_order", {
        orderId: order._id,
        totalAmount,
      });

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        orderId: order._id,
        pickupCode: plainPickUpCode,
      });
    }

    if (paymentMethod === "counter") {
      // Restriction: Only Staff and Admin can place Counter orders (Cash)
      if (req.user.role === "student") {
        res.status(403);
        throw new Error(
          "Prepaid only. Students must use Wallet or Online Payment.",
        );
      }

      const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount,
        status: "pending",
        paymentMethod: "counter",
        isPaid: false,
        pickupCode: hashedPickUpCode,
        pickupCodePlain: plainPickUpCode,
      });

      await Notification.create({
        user: userId,
        title: "Order Placed",
        message: `Order #${order._id.toString().slice(-4).toUpperCase()} placed. Pay at counter.`,
        type: "order",
      });

      await redisClient.del(cartKey);

      const io = getIo();
      io.to("kitchen_room").emit("new_order", {
        orderId: order._id,
        totalAmount,
      });
      io.to("admin_dashboard").emit("new_order", {
        orderId: order._id,
        totalAmount,
      });

      return res.status(201).json({
        success: true,
        message: "Order created successfully. Please pay at counter.",
        orderId: order._id,
        pickupCode: plainPickUpCode,
      });
    }

    if (paymentMethod === "razorpay") {
      if (!razorpay) {
        res.status(503);
        throw new Error("Online payment is currently unavailable.");
      }

      // Create a Razorpay Order
      const options = {
        amount: Math.round(totalAmount * 100), // paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const rpOrder = await razorpay.orders.create(options);

      const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount,
        status: "pending_payment",
        paymentMethod: "razorpay",
        isPaid: false,
        pickupCode: hashedPickUpCode,
        pickupCodePlain: plainPickUpCode,
        razorpayOrderId: rpOrder.id,
      });

      // We do NOT clear cart or notify kitchen yet.
      // This happens after payment verification.

      return res.status(201).json({
        success: true,
        message: "Razorpay order created",
        orderId: order._id,
        razorpayOrderId: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
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

    const validTransitions = {
      pending: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["completed", "cancelled"],
    };
    const allowed = validTransitions[order.status];
    if (!allowed || !allowed.includes(status)) {
      res.status(400);
      throw new Error(`Cannot move from '${order.status}' to '${status}'`);
    }

    // Handle refund for cancelled orders
    if (status === "cancelled" && order.isPaid) {
      const user = await User.findById(order.user);
      if (!user) {
        res.status(404);
        throw new Error("User not found");
      }

      // Check user's refund preference
      const refundToWallet =
        user.refundPreference === "wallet" || order.paymentMethod === "wallet";

      // If paid via Razorpay
      if (order.paymentMethod === "razorpay" && order.razorpayPaymentId) {
        if (refundToWallet) {
          // User wants refund in wallet - instant credit
          user.walletBalance += order.totalAmount;
          await user.save();

          await Transaction.create({
            userId: order.user,
            amount: order.totalAmount,
            type: "credit",
            description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Wallet credit)`,
          });
        } else {
          // User wants refund to original payment method (bank/UPI)
          try {
            if (razorpay) {
              const refund = await razorpay.payments.refund(
                order.razorpayPaymentId,
                {
                  amount: order.totalAmount * 100, // amount in paise
                  speed: "normal", // 5-7 business days
                },
              );

              await Transaction.create({
                userId: order.user,
                amount: order.totalAmount,
                type: "credit",
                description: `Refund initiated for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Razorpay Refund ID: ${refund.id})`,
              });

              order.razorpayRefundId = refund.id;
            } else {
              // Razorpay not configured, fallback to wallet
              user.walletBalance += order.totalAmount;
              await user.save();

              await Transaction.create({
                userId: order.user,
                amount: order.totalAmount,
                type: "credit",
                description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Wallet credit)`,
              });
            }
          } catch (refundError) {
            // If Razorpay refund fails, credit to wallet as fallback
            user.walletBalance += order.totalAmount;
            await user.save();

            await Transaction.create({
              userId: order.user,
              amount: order.totalAmount,
              type: "credit",
              description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Wallet credit - Bank refund failed)`,
            });
          }
        }
      } else {
        // Wallet or counter payment - always refund to wallet
        user.walletBalance += order.totalAmount;
        await user.save();

        await Transaction.create({
          userId: order.user,
          amount: order.totalAmount,
          type: "credit",
          description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()}`,
        });
      }
    }

    order.status = status;

    // Track who cancelled the order
    if (status === "cancelled") {
      order.cancelledBy = "admin";
      order.cancellationReason = "Cancelled by canteen/admin";
    }

    await order.save();

    let notifTitle = `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    let notifMessage = `Order #${order._id.toString().slice(-4).toUpperCase()} is now ${status}.`;

    if (status === "ready" && order.pickupCodePlain) {
      notifMessage = `Order #${order._id.toString().slice(-4).toUpperCase()} is ready! Pickup Code: ${order.pickupCodePlain}`;
    } else if (status === "cancelled" && order.isPaid) {
      notifTitle = "Order Cancelled by Canteen";
      const user = await User.findById(order.user);
      const refundMethod =
        user?.refundPreference === "wallet" || order.paymentMethod === "wallet"
          ? "wallet"
          : "bank account";
      const refundTime =
        refundMethod === "wallet" ? "instantly" : "in 5-7 business days";
      notifMessage = `Your order #${order._id.toString().slice(-4).toUpperCase()} has been cancelled by the canteen. ₹${order.totalAmount} will be refunded to your ${refundMethod} ${refundTime}.`;
    } else if (status === "cancelled") {
      notifTitle = "Order Cancelled by Canteen";
      notifMessage = `Your order #${order._id.toString().slice(-4).toUpperCase()} has been cancelled by the canteen.`;
    }

    await Notification.create({
      user: order.user,
      title: notifTitle,
      message: notifMessage,
      type: "order",
    });

    const io = getIo();

    io.to(`user_${order.user}`).emit("order_status_updated", {
      orderId: order._id,
      status: order.status,
      pickupCodePlain: order.pickupCodePlain || null,
      cancelledBy: order.cancelledBy || null, // Track who cancelled (admin vs student)
    });

    // Emit wallet refund event if refund was processed
    if (status === "cancelled" && order.isPaid) {
      const refundUser = await User.findById(order.user);
      const refundMethod =
        refundUser?.refundPreference === "wallet" ||
        order.paymentMethod === "wallet"
          ? "wallet"
          : "bank";

      io.to(`user_${order.user}`).emit("wallet_refund", {
        amount: order.totalAmount,
        orderId: order._id,
        refundMethod,
        message: `₹${order.totalAmount} refunded successfully to your ${refundMethod}`,
      });

      logger.info(
        `Wallet refund event emitted to user ${order.user} for ₹${order.totalAmount}`,
      );
    }

    io.to("admin_dashboard").emit("order_status_updated", {
      orderId: order._id,
      status: order.status,
    });

    io.to("kitchen_room").emit("order_status_updated", {
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

    await Notification.create({
      user: order.user,
      title: "Order Completed",
      message: `Order #${order._id.toString().slice(-4).toUpperCase()} has been picked up & completed.`,
      type: "order",
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

    io.to("kitchen_room").emit("order_status_updated", {
      orderId: order._id,
      status: order.status,
    });

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

    // Clear user cart
    const cartKey = `cart:${order.user}`;
    await redisClient.del(cartKey);

    await Transaction.create({
      userId: order.user,
      amount: order.totalAmount,
      type: "debit",
      description: `Order Placed (Razorpay)`,
    });

    await Notification.create({
      user: order.user,
      title: "Payment Successful",
      message: `Order #${order._id.toString().slice(-4).toUpperCase()} paid via Razorpay.`,
      type: "order",
    });

    const io = getIo();

    io.to(`user_${order.user}`).emit("payment_success", {
      orderId: order._id,
      pickupCode: order.pickupCodePlain,
    });

    io.to("kitchen_room").emit("new_order", {
      orderId: order._id,
      totalAmount: order.totalAmount,
    });
    io.to("admin_dashboard").emit("new_order", {
      orderId: order._id,
      totalAmount: order.totalAmount,
    });

    res.json({
      success: true,
      message: "Payment verified successfully",
      pickupCode: order.pickupCodePlain,
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

// ─────────────────────────────────────────────────────────
// User Cancel Order (with automatic refund)
// ─────────────────────────────────────────────────────────
export const cancelMyOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Verify order belongs to user
    if (order.user.toString() !== userId.toString()) {
      res.status(403);
      throw new Error("You can only cancel your own orders");
    }

    // Check if order can be cancelled
    const cancellableStatuses = ["pending", "paid", "accepted"];
    if (!cancellableStatuses.includes(order.status)) {
      res.status(400);
      throw new Error(
        `Cannot cancel order in '${order.status}' status. Orders can only be cancelled before preparation starts.`,
      );
    }

    // Process refund if order was paid
    if (order.isPaid) {
      const user = await User.findById(userId);
      if (!user) {
        res.status(404);
        throw new Error("User not found");
      }

      // Check user's refund preference
      const refundToWallet =
        user.refundPreference === "wallet" || order.paymentMethod === "wallet";

      // If paid via Razorpay
      if (order.paymentMethod === "razorpay" && order.razorpayPaymentId) {
        if (refundToWallet) {
          // User wants refund in wallet - instant credit
          user.walletBalance += order.totalAmount;
          await user.save();

          await Transaction.create({
            userId: order.user,
            amount: order.totalAmount,
            type: "credit",
            description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Wallet credit)`,
            status: "success",
          });

          logger.info(
            `Order ${orderId} cancelled - Refund ₹${order.totalAmount} credited to wallet`,
          );
        } else {
          // User wants refund to original payment method (bank/UPI)
          try {
            if (razorpay) {
              const refund = await razorpay.payments.refund(
                order.razorpayPaymentId,
                {
                  amount: order.totalAmount * 100, // amount in paise
                  speed: "normal", // 5-7 business days
                },
              );

              await Transaction.create({
                userId: order.user,
                amount: order.totalAmount,
                type: "credit",
                description: `Refund initiated for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Razorpay Refund ID: ${refund.id})`,
                status: "processing",
              });

              order.razorpayRefundId = refund.id;

              logger.info(
                `Order ${orderId} cancelled - Razorpay refund initiated: ${refund.id}`,
              );
            } else {
              // Razorpay not configured, fallback to wallet
              user.walletBalance += order.totalAmount;
              await user.save();

              await Transaction.create({
                userId: order.user,
                amount: order.totalAmount,
                type: "credit",
                description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Wallet credit)`,
                status: "success",
              });
            }
          } catch (refundError) {
            logger.error(`Razorpay refund failed: ${refundError.message}`);
            // If Razorpay refund fails, credit to wallet as fallback
            user.walletBalance += order.totalAmount;
            await user.save();

            await Transaction.create({
              userId: order.user,
              amount: order.totalAmount,
              type: "credit",
              description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()} (Wallet credit - Bank refund failed)`,
              status: "success",
            });
          }
        }
      } else {
        // Wallet or counter payment - always refund to wallet
        user.walletBalance += order.totalAmount;
        await user.save();

        await Transaction.create({
          userId: order.user,
          amount: order.totalAmount,
          type: "credit",
          description: `Refund for cancelled order #${order._id.toString().slice(-4).toUpperCase()}`,
          status: "success",
        });

        logger.info(
          `Order ${orderId} cancelled - Refund ₹${order.totalAmount} credited to wallet`,
        );
      }
    }

    // Update order status
    order.status = "cancelled";
    order.cancelledBy = "student";
    order.cancellationReason = "Cancelled by customer";
    await order.save();

    // Send notification
    const user = await User.findById(userId);
    const userDetails = user; // Use same user object
    const refundMethod =
      user?.refundPreference === "wallet" || order.paymentMethod === "wallet"
        ? "wallet"
        : "bank account";
    const refundTime =
      refundMethod === "wallet" ? "instantly" : "in 5-7 business days";

    const notifMessage = order.isPaid
      ? `You cancelled order #${order._id.toString().slice(-4).toUpperCase()}. ₹${order.totalAmount} will be refunded to your ${refundMethod} ${refundTime}.`
      : `You cancelled order #${order._id.toString().slice(-4).toUpperCase()}.`;

    await Notification.create({
      user: order.user,
      title: "Order Cancelled",
      message: notifMessage,
      type: "order",
    });

    // 🆕 CREATE NOTIFICATIONS FOR ALL ADMIN/STAFF USERS
    // Get all admin and staff users
    const adminUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Create notification for each admin/staff
    const studentName = userDetails?.name || "A student";
    const orderIdShort = order._id.toString().slice(-4).toUpperCase();
    const adminNotifications = adminUsers.map((admin) => ({
      user: admin._id,
      title: "Student Cancelled Order",
      message: `${studentName} cancelled order #${orderIdShort} (₹${order.totalAmount})`,
      type: "order",
      isRead: false,
    }));

    if (adminNotifications.length > 0) {
      await Notification.insertMany(adminNotifications);
      logger.info(
        `Created ${adminNotifications.length} admin notifications for order cancellation by ${studentName}`,
      );
    }

    // Emit socket event
    const io = getIo();
    io.to(`user_${order.user}`).emit("order_status_updated", {
      orderId: order._id,
      status: "cancelled",
      cancelledBy: "student", // Student cancelled their own order
    });

    // Emit wallet refund event if refund was processed
    if (order.isPaid) {
      io.to(`user_${order.user}`).emit("wallet_refund", {
        amount: order.totalAmount,
        orderId: order._id,
        refundMethod: refundMethod.replace(" account", ""),
        message: `₹${order.totalAmount} refunded successfully to your ${refundMethod.replace(" account", "")}`,
      });

      logger.info(
        `Wallet refund event emitted to user ${order.user} for ₹${order.totalAmount}`,
      );
    }

    io.to("admin_dashboard").emit("order_status_updated", {
      orderId: order._id,
      status: "cancelled",
    });

    // Emit admin notification for user cancellation (toast + notification panel refresh)
    io.to("admin_dashboard").emit("user_cancelled_order", {
      orderId: order._id,
      orderIdShort: orderIdShort,
      userName: studentName,
      userEmail: userDetails?.email || "",
      totalAmount: order.totalAmount,
      itemCount: order.items?.length || 0,
      cancelledAt: new Date(),
      refundAmount: order.isPaid ? order.totalAmount : 0,
      refundMethod: order.isPaid ? refundMethod : null,
    });

    // 🆕 Emit event to refresh admin notification panel
    io.to("admin_dashboard").emit("new_notification", {
      type: "order_cancellation",
      title: "Student Cancelled Order",
      message: `${studentName} cancelled order #${orderIdShort} (₹${order.totalAmount})`,
      timestamp: new Date(),
    });

    logger.info(
      `Admin notified: Order ${order._id} cancelled by user ${order.user}`,
    );

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      refunded: order.isPaid,
      refundAmount: order.isPaid ? order.totalAmount : 0,
      refundMethod: order.isPaid ? refundMethod : null,
      order,
    });
  } catch (error) {
    next(error);
  }
};
