import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { redisClient } from "../config/redis.js";
import Order from "../models/Order.js";
import Menu from "../models/Menu.js";

const generatePickupCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ================= CREATE ORDER =================
export const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
    }).session(session);

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

    const plainPickupCode = generatePickupCode();

    const hashedPickupCode = await bcrypt.hash(plainPickupCode, 10);

    const order = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          totalAmount,
          pickupCode: hashedPickupCode,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await redisClient.del(cartKey);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderId: order[0]._id,
      pickupCode: plainPickupCode, // return plain only once
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


