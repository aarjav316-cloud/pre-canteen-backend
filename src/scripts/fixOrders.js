import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order.js";

dotenv.config();

const fixOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Update all orders that don't have pickupCodePlain
    const result = await Order.updateMany(
      { pickupCodePlain: { $exists: false } },
      { $set: { pickupCodePlain: "000000" } },
    );

    console.log(`✓ Fixed ${result.modifiedCount} orders`);
    console.log("All orders now have pickupCodePlain field");

    process.exit(0);
  } catch (error) {
    console.error("Error fixing orders:", error.message);
    process.exit(1);
  }
};

fixOrders();
