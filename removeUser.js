import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";

dotenv.config();

const removeUserByMobile = async (mobile) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({ mobile });

    if (!user) {
      console.log(`❌ No user found with mobile number: ${mobile}`);
      return;
    }

    console.log("📋 User details:");
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email || "N/A"}`);
    console.log(`   Mobile: ${user.mobile}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   College: ${user.college}`);

    await User.deleteOne({ mobile });
    console.log(`✅ User with mobile ${mobile} has been removed successfully!`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
};

// Remove user with mobile 9755099244
removeUserByMobile("9755099244");
