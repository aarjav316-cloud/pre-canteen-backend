import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@canteen.com" });

    if (existingAdmin) {
      console.log("Admin already exists!");
      console.log("Email: admin@canteen.com");
      console.log("Password: admin123");
      process.exit(0);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admin = await User.create({
      name: "Canteen Owner",
      email: "admin@canteen.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✓ Admin user created successfully!");
    console.log("Email: admin@canteen.com");
    console.log("Password: admin123");
    console.log("\nYou can now login with these credentials.");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error.message);
    process.exit(1);
  }
};

createAdmin();
