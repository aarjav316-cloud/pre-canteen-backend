import bcrypt from "bcryptjs";
import { redisClient } from "../config/redis.js";

import Order from "../models/Order.js";
import Menu from "../models/Menu.js";
import { getIo } from "../config/socket.js";

import razorpay from "../config/razorpay.js";
import crypto from "crypto"
import { trace } from "console";

const generatePickupCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createOrder = async (req, res, next) => {
  try {

    const userId = req.user._id.toString();
    const cartKey = `cart:${userId}`;

    const cartItems = await redisClient.hGetAll(cartKey);

    if (Object.keys(cartItems).length === 0) {
      res.status(400);
      throw new Error("Cart is empty");
    }

    const menuIds = Object.keys(cartItems);

    const menuItems = await Menu.find({
      _id: { $in: menuIds },
    });

    let orderItems = [];
    let totalAmount = 0;

    for (let item of menuItems) {

      const quantity = Number(cartItems[item._id]);

      orderItems.push({
        menu: item._id,
        name: item.name,
        price: item.price,
        quantity,
      });

      totalAmount += item.price * quantity;
    }

    const plainPickUpCode = generatePickupCode();
    const hashedPickUpCode = await bcrypt.hash(plainPickUpCode, 10);

    const existingOrder = await Order.findOne({
      user: userId,
      status: { $in: ["pending", "paid", "preparing", "ready"] },
    });

    if (existingOrder) {
      res.status(400);
      throw new Error("You already have an active order");
    }

    const order = await Order.create({
      user: userId,
      items: orderItems,
      totalAmount,
      pickupCode: hashedPickUpCode,
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

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderId: order._id,
      pickupCode: plainPickUpCode,
    });

  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {

   const {orderId} = req.params;
   const {status} = req.body;

   const order = await Order.findById(orderId)

   if(!order){
    res.status(404)
    throw new Error("Order not found")
   }

   order.status = status;
   await order.save();


   const io = getIo()

   io.to(`user_${order.user}`).emit("order_status_updated" , {
      orderId: order._id,
      status: order.status,
   })

   io.to("admin_dashboard").emit("order_status_updated" , {
     orderId: order._id,
     status: order.status,
   } )

   res.json({
    success:true,
    message:"order status updated",
    data : order,
   });

  } catch (error) {
    next(error);
  }
};


export const verifyPickUpCode = async (req,res,next) => {
  try {

    const {orderId} = req.params;
    const {pickupCode} = req.body;

    const order = await Order.findById(orderId)

    if(!order) {
      res.status(404);
      throw new Error("order not found")
    }

    if(order.status !== "ready"){
      res.status(400);
      throw new Error("Order is not ready for pickup");
    }

    const isMatch = await bcrypt.compare(
      pickupCode,
      order.pickupCode
    );

    if(!isMatch){
      res.status(400);
      throw new Error("Invalid pickup code")
    }

    order.status = "completed";
    await order.save()

    res.json({
      success: true,
      message: "Order completed successfully",
    });
    
  } catch (error) {
    next(error)
  }
}


export const getMyOrders = async (req,res,next) => {
  try {

    const orders = await Order.find({
       user: req.user._id,
    }).sort({createdAt: -1})

    res.json({
      success:true,
      data:orders
    });
    
  } catch (error) {
    next(error)
  }
}


export const getAllOrders = async(req , res , next) => {
   try {

    const orders = await Order.find()
    .populate('user' , "name email")
    .sort({createdAt: -1})


    res.json({
      success:true,
      data:orders
    })
    
   } catch (error) {
    next(error)
   }
}


export const createPayment = async (req,res,next) => {
  try {

    const {orderId} = req.params;

    if(!orderId){
      throw new Error("order not found")
    }

    const order = await Order.findById(orderId)

    if(!order){
      throw new Error("order not found")
    }

    if(order.isPaid){
      throw new Error("already paid for this item")
    }

    const options = {
      amount: order.totalAmount * 100,
      currency: "INR",
      receipt: order._id.toString(),
    }

    const razorPayOrder = await razorpay.orders.create(options);

    order.razorpayOrderId = razorPayOrder.id;

    res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      key: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
    });

    await order.save()
    
  } catch (error) {
    next(error)
  }
}



export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

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
    order.status = "paid";
    order.razorpayPaymentId = razorpay_payment_id;

    await order.save();

    const io = getIo()

    io.to(`user_${order.user}`).emit("payment_success" ,{
      orderId: order._id,
    })

    io.to("admin_dashboard").emit("payment_success"  , {
      orderId: order.id,
    })

    res.json({
      success: true,
      message: "Payment verified successfully",
    });

  } catch (error) {
    next(error);
  }
};


export const getRevenueByDay = async (req , res , next)=> {
  try {

    const revenue = await Order.aggregate([
      {
        $match : {status:"completed"},
      },
      {
        $group: {
          _id:{
            year: {$year: "$createdAt"},
            month:{$month: "$createdAt"},
            day:{$dayOfMonth: "$createdAt"},
          },
          totalRevenue:{$sum: "$totalAmount"},
          totalOrders:{$sum:1},
        },
      },
      {
        $sort: {"_id.year":1,"_id.month":1,"_id.day":1},
      }
    ]);

    return res.json({
      success:true,
      data:revenue
    })
    
  } catch (error) {
    next(error)
  }
}



export const getRevenueByMonth = async (req,res,next) => {
  try {

    const revenue = await Order.aggregate([
      {
        $match:{status:"completed"},
      },
      {
        $group:{
          _id:{
            year:{$year:"$createdAt"},
            month:{$month:"$createdAt"},
          },
          totalRevenue:{$sum:"$totalAmount"},
          totalOrders:{$sum:1},
        },
      },
      {
        $sort:{"_id.year":1, "_id.month":1},
      },
    ]);

    return res.json({
      success:true,
      data:revenue
    })
    
  } catch (error) {
    next(error)
  }
}



export const getTopSellingItems = async(req,res,next) => {
  try {

    const items = await Order.aggregate([
       { $match: { status:"completed"} },
       {$unwind: "$items"},

       {
         $group: {
           _id:"$items.name",
           totalSold:{$sum:"$items.quantity"},
           revenue: {
             $sum: {
               $multiply:["$items.price" , "$items.quantity"],
             },
           },
         },
       },

       {$sort: {totalSold:-1}},

       {$limit:5}
    ])

    res.json({
      success: true,
      data: items,
    });

    
  } catch (error) {
    next(error)
  }
}





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
