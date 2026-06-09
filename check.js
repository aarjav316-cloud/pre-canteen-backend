import mongoose from "mongoose";
import Order from "./src/models/Order.js";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const orders = await Order.find().sort({ createdAt: -1 }).limit(5);
  console.log("Recent orders:", orders);
  
  process.exit(0);
}

check();
