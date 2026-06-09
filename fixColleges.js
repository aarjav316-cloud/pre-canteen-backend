/**
 * Fix College Field for All Users
 *
 * Usage: node fixColleges.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const fixColleges = async () => {
  try {
    console.log("\n🔧 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // Update ALL documents, including those without college field
    const result = await usersCollection.updateMany(
      {},
      {
        $set: { college: "Medicaps University" },
      },
    );

    console.log("✅ College field updated!");
    console.log(`📊 Matched: ${result.matchedCount}`);
    console.log(`📊 Modified: ${result.modifiedCount}\n`);

    // Verify the update
    const users = await usersCollection.find({}).toArray();

    console.log("📋 All Users After Update:");
    console.log("─────────────────────────────────────────────────────────");
    users.forEach((user) => {
      console.log(
        `${(user.name || "N/A").padEnd(20)} | ${(user.role || "N/A").padEnd(10)} | ${user.college || "MISSING"}`,
      );
    });
    console.log("─────────────────────────────────────────────────────────\n");

    await mongoose.connection.close();
    console.log("✅ Done!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixColleges();
