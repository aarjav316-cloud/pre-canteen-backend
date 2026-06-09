/**
 * SMS Service Test Script
 *
 * Usage: node src/utils/testSms.js [mobile] [otp]
 * Example: node src/utils/testSms.js 9876543210 123456
 */

import dotenv from "dotenv";
import { sendOtpSms } from "./smsService.js";
import logger from "./logger.js";

// Load environment variables
dotenv.config();

const testMobile = process.argv[2] || "9876543210";
const testOtp = process.argv[3] || "123456";

console.log("\n📱 Testing SMS Service...\n");
console.log(`Provider: ${process.env.SMS_PROVIDER || "twilio"}`);
console.log(`SMS Enabled: ${process.env.SMS_ENABLED || "false"}`);
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Mobile: ${testMobile}`);
console.log(`OTP: ${testOtp}\n`);

// Test SMS sending
try {
  const result = await sendOtpSms(testMobile, testOtp);
  console.log("✅ SMS Test Result:", result);
  console.log("\n✅ SMS service is working correctly!");
  process.exit(0);
} catch (error) {
  console.error("❌ SMS Test Failed:", error.message);
  console.error("\nTroubleshooting:");
  console.error("1. Check your .env file has correct SMS credentials");
  console.error(
    "2. Verify SMS_PROVIDER is set correctly (twilio/msg91/fast2sms)",
  );
  console.error("3. Ensure SMS_ENABLED=true for actual SMS sending");
  console.error("4. Check the SMS_SETUP.md guide for provider-specific setup");
  process.exit(1);
}
