/**
 * Create Admin User Script
 *
 * Usage: node createAdmin.js
 *
 * This will create an admin user with predefined credentials
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

// Load environment variables
dotenv.config();

// Admin credentials
const ADMIN_CREDENTIALS = {
  name: "Admin",
  email: "admin@precanteen.com",
  mobile: "9999999999",
  password: "admin123",
  role: "admin",
  college: "Medicaps University",
};

const createAdmin = async () => {
  try {
    console.log("\n🔧 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { email: ADMIN_CREDENTIALS.email },
        { mobile: ADMIN_CREDENTIALS.mobile },
      ],
    });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists!");
      console.log("\n📋 Existing Admin Details:");
      console.log("─────────────────────────────────────");
      console.log(`Name:     ${existingAdmin.name}`);
      console.log(`Email:    ${existingAdmin.email || "N/A"}`);
      console.log(`Mobile:   ${existingAdmin.mobile || "N/A"}`);
      console.log(`Role:     ${existingAdmin.role}`);
      console.log("─────────────────────────────────────");

      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(
        "\nDo you want to update the password to 'admin123'? (yes/no): ",
        async (answer) => {
          if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            existingAdmin.password = hashedPassword;
            await existingAdmin.save();
            console.log("\n✅ Password updated successfully!");
            console.log("\n📋 Login Credentials:");
            console.log("─────────────────────────────────────");
            console.log(
              `Email/Mobile: ${existingAdmin.email || existingAdmin.mobile}`,
            );
            console.log(`Password:     admin123`);
            console.log("─────────────────────────────────────\n");
          } else {
            console.log("\n❌ Password not updated.");
          }
          rl.close();
          await mongoose.connection.close();
          process.exit(0);
        },
      );
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_CREDENTIALS.password, 10);

    // Create admin user
    const admin = await User.create({
      ...ADMIN_CREDENTIALS,
      password: hashedPassword,
      authType: "local",
    });

    console.log("✅ Admin user created successfully!\n");
    console.log("📋 Admin Login Credentials:");
    console.log("─────────────────────────────────────");
    console.log(`Name:         ${admin.name}`);
    console.log(`Email:        ${admin.email}`);
    console.log(`Mobile:       ${admin.mobile}`);
    console.log(`Password:     ${ADMIN_CREDENTIALS.password}`);
    console.log(`Role:         ${admin.role}`);
    console.log("─────────────────────────────────────");
    console.log("\n💡 You can now login with:");
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Mobile:   ${admin.mobile}`);
    console.log(`   Password: ${ADMIN_CREDENTIALS.password}`);
    console.log("\n🔐 Login endpoint: POST /api/auth/login");
    console.log('   Body: { "mobile": "9999999999", "password": "admin123" }');
    console.log("\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating admin:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
createAdmin();
