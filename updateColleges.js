/**
 * Update College Name for All Users
 *
 * Usage: node updateColleges.js
 *
 * This will update all users to have "Medicaps University" as their college
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./src/models/User.js";

// Load environment variables
dotenv.config();

const updateColleges = async () => {
  try {
    console.log("\n🔧 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Update all users to have Medicaps University
    const result = await User.updateMany(
      {},
      { $set: { college: "Medicaps University" } },
    );

    console.log("✅ College updated successfully!");
    console.log(`📊 Updated ${result.modifiedCount} user(s)\n`);

    // Show all users with their updated college
    const users = await User.find({}, "name mobile email role college");

    if (users.length > 0) {
      console.log("📋 All Users:");
      console.log("─────────────────────────────────────────────────────────");
      users.forEach((user) => {
        console.log(
          `${user.name.padEnd(20)} | ${user.role.padEnd(10)} | ${user.college}`,
        );
      });
      console.log(
        "─────────────────────────────────────────────────────────\n",
      );
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error updating colleges:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
updateColleges();
