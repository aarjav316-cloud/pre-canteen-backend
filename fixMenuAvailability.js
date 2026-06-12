/**
 * Fix Menu Availability Script
 *
 * This script updates all existing menu items to have isAvailable: true
 * and clears the Redis cache
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Menu from "./src/models/Menu.js";
import { redisClient, connectRedis } from "./src/config/redis.js";

dotenv.config();

const fixMenuAvailability = async () => {
  try {
    console.log("\n🔧 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔧 Connecting to Redis...");
    await connectRedis();
    console.log("✅ Connected to Redis\n");

    // Check current state
    const allMenus = await Menu.find({});
    console.log(`📊 Found ${allMenus.length} menu items in database\n`);

    console.log("Current menu items:");
    console.log("─────────────────────────────────────────────────────────");
    allMenus.forEach((item) => {
      console.log(
        `${item.name.padEnd(25)} | ${item.category.padEnd(12)} | isAvailable: ${item.isAvailable !== undefined ? item.isAvailable : "MISSING"}`,
      );
    });
    console.log("─────────────────────────────────────────────────────────\n");

    // Update all menu items to have isAvailable: true
    const result = await Menu.updateMany({}, { $set: { isAvailable: true } });

    console.log(
      `✅ Updated ${result.modifiedCount} menu items to isAvailable: true\n`,
    );

    // Clear Redis cache
    console.log("🧹 Clearing Redis cache...");
    await redisClient.del("menu:all");
    await redisClient.del("menu:admin_all");
    console.log("✅ Redis cache cleared\n");

    // Verify the fix
    const availableMenus = await Menu.find({ isAvailable: true });
    console.log(
      `✅ Verification: ${availableMenus.length} menu items are now available\n`,
    );

    console.log("Updated menu items:");
    console.log("─────────────────────────────────────────────────────────");
    availableMenus.forEach((item) => {
      console.log(
        `${item.name.padEnd(25)} | ${item.category.padEnd(12)} | ₹${item.price.toString().padEnd(5)} | ✅ Available`,
      );
    });
    console.log("─────────────────────────────────────────────────────────\n");

    console.log("✨ All done! Menu items should now appear in the frontend.\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixMenuAvailability();
