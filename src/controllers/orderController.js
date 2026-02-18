import bcrypt from "bcryptjs";
import { redisClient } from "../config/redis.js";
import Order from "../models/Order.js";
import Menu from "../models/Menu.js";

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


