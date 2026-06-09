/**
 * Create Staff User Script
 *
 * Usage: node createStaff.js
 *
 * This will create a staff user with predefined credentials
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

// Load environment variables
dotenv.config();

// Staff credentials
const STAFF_CREDENTIALS = {
  name: "Staff User",
  email: "staff@precanteen.com",
  mobile: "8888888888",
  password: "staff123",
  role: "staff",
  college: "Medicaps University",
};

const createStaff = async () => {
  try {
    console.log("\n🔧 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check if staff already exists
    const existingStaff = await User.findOne({
      $or: [
        { email: STAFF_CREDENTIALS.email },
        { mobile: STAFF_CREDENTIALS.mobile },
      ],
    });

    if (existingStaff) {
      console.log("⚠️  Staff user already exists!");
      console.log("\n📋 Existing Staff Details:");
      console.log("─────────────────────────────────────");
      console.log(`Name:     ${existingStaff.name}`);
      console.log(`Email:    ${existingStaff.email || "N/A"}`);
      console.log(`Mobile:   ${existingStaff.mobile || "N/A"}`);
      console.log(`Role:     ${existingStaff.role}`);
      console.log("─────────────────────────────────────\n");

      await mongoose.connection.close();
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(STAFF_CREDENTIALS.password, 10);

    // Create staff user
    const staff = await User.create({
      ...STAFF_CREDENTIALS,
      password: hashedPassword,
      authType: "local",
    });

    console.log("✅ Staff user created successfully!\n");
    console.log("📋 Staff Login Credentials:");
    console.log("─────────────────────────────────────");
    console.log(`Name:         ${staff.name}`);
    console.log(`Email:        ${staff.email}`);
    console.log(`Mobile:       ${staff.mobile}`);
    console.log(`Password:     ${STAFF_CREDENTIALS.password}`);
    console.log(`Role:         ${staff.role}`);
    console.log("─────────────────────────────────────");
    console.log("\n💡 You can now login with:");
    console.log(`   Mobile:   ${staff.mobile}`);
    console.log(`   Password: ${STAFF_CREDENTIALS.password}`);
    console.log("\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating staff:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
createStaff();
