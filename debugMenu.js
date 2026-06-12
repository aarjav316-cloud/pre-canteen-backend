/**
 * Debug Menu API Script
 *
 * This script tests the complete flow from database to API response
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Menu from "./src/models/Menu.js";
import { redisClient, connectRedis } from "./src/config/redis.js";

dotenv.config();

const debugMenu = async () => {
  try {
    console.log("\n🔍 MENU DEBUG DIAGNOSTICS");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    // 1. Connect to MongoDB
    console.log("1️⃣  Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("   ✅ MongoDB Connected\n");

    // 2. Connect to Redis
    console.log("2️⃣  Connecting to Redis...");
    await connectRedis();
    console.log("   ✅ Redis Connected\n");

    // 3. Check database directly
    console.log("3️⃣  Querying MongoDB directly...");
    const allItems = await Menu.find({});
    console.log(`   📊 Total items in database: ${allItems.length}`);

    if (allItems.length > 0) {
      console.log("\n   Database Items:");
      console.log(
        "   ─────────────────────────────────────────────────────────",
      );
      allItems.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.name}`);
        console.log(`      Category: ${item.category}`);
        console.log(`      Price: ₹${item.price}`);
        console.log(`      isAvailable: ${item.isAvailable}`);
        console.log(`      ID: ${item._id}`);
        console.log("");
      });
    } else {
      console.log("   ⚠️  No items found in database!\n");
    }

    // 4. Query with isAvailable filter (what the API does)
    console.log("4️⃣  Querying with isAvailable: true filter...");
    const availableItems = await Menu.find({ isAvailable: true });
    console.log(`   📊 Available items: ${availableItems.length}`);

    if (availableItems.length > 0) {
      console.log("\n   Available Items (API will return these):");
      console.log(
        "   ─────────────────────────────────────────────────────────",
      );
      availableItems.forEach((item, idx) => {
        console.log(
          `   ${idx + 1}. ${item.name} (${item.category}) - ₹${item.price}`,
        );
      });
    } else {
      console.log("   ⚠️  No available items found!\n");
    }

    // 5. Check Redis cache
    console.log("\n5️⃣  Checking Redis cache...");
    const cachedAll = await redisClient.get("menu:all");
    const cachedAdmin = await redisClient.get("menu:admin_all");

    console.log(`   menu:all cache: ${cachedAll ? "EXISTS" : "EMPTY"}`);
    if (cachedAll) {
      const parsed = JSON.parse(cachedAll);
      console.log(`   ├─ Cached items count: ${parsed.length}`);
      if (parsed.length > 0) {
        console.log(`   └─ Sample: ${parsed[0].name}`);
      } else {
        console.log("   └─ ⚠️  Cache exists but is EMPTY array!");
      }
    }

    console.log(`   menu:admin_all cache: ${cachedAdmin ? "EXISTS" : "EMPTY"}`);
    if (cachedAdmin) {
      const parsed = JSON.parse(cachedAdmin);
      console.log(`   └─ Cached admin items count: ${parsed.length}`);
    }

    // 6. Clear cache recommendation
    if (cachedAll || cachedAdmin) {
      console.log("\n6️⃣  Clearing Redis cache...");
      await redisClient.del("menu:all");
      await redisClient.del("menu:admin_all");
      console.log("   ✅ Cache cleared\n");
    }

    // 7. Database connection check
    console.log("7️⃣  Database info:");
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log(`   Collection: menus`);
    console.log(
      `   Connection state: ${mongoose.connection.readyState === 1 ? "Connected" : "Not Connected"}\n`,
    );

    // 8. Summary
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 SUMMARY:");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`✓ Total items in DB: ${allItems.length}`);
    console.log(`✓ Available items (API returns): ${availableItems.length}`);
    console.log(
      `✓ Redis cache: ${cachedAll || cachedAdmin ? "Was cleared" : "Was empty"}`,
    );

    if (availableItems.length === 0 && allItems.length > 0) {
      console.log("\n⚠️  ISSUE FOUND: Items exist but none are available!");
      console.log("   Reason: All items have isAvailable: false");
      console.log("   Fix: Run 'node fixMenuAvailability.js'");
    } else if (allItems.length === 0) {
      console.log("\n⚠️  ISSUE FOUND: No items in database!");
      console.log("   Fix: Add menu items via admin panel");
    } else if (availableItems.length > 0) {
      console.log("\n✅ Database looks good!");
      console.log("   If frontend still shows 'No Items Found':");
      console.log(
        "   1. Check if backend is running (http://localhost:5000/health)",
      );
      console.log("   2. Check browser console for API errors");
      console.log("   3. Check network tab for /api/menu request");
      console.log("   4. Verify VITE_API_BASE_URL in frontend/.env");
    }

    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
};

debugMenu();
