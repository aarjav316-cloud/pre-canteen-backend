import mongoose from "mongoose";
import Order from "./src/models/Order.js";

console.log(Order.schema.path("paymentMethod").enumValues);
process.exit(0);
