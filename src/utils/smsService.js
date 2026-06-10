import axios from "axios";
import logger from "./logger.js";

/**
 * SMS Service - Supports multiple providers
 * Configured via .env variables
 *
 * Providers supported:
 * - Twilio (recommended for production)
 * - MSG91 (popular in India)
 * - Fast2SMS (free tier available)
 */

const SMS_PROVIDER = process.env.SMS_PROVIDER || "twilio"; // twilio | msg91 | fast2sms

/**
 * Send OTP via SMS
 * @param {string} mobile - Mobile number (10 digits for India)
 * @param {string} otp - OTP code to send
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendOtpSms = async (mobile, otp) => {
  try {
    // In development mode, just log the OTP
    if (process.env.NODE_ENV === "development" && !process.env.SMS_ENABLED) {
      logger.info(`📱 [DEV MODE] OTP for ${mobile}: ${otp}`);
      console.log(`\n📱 SMS OTP for ${mobile}: ${otp}\n`);
      return { success: true, message: "OTP logged (dev mode)" };
    }

    // Route to appropriate provider
    switch (SMS_PROVIDER.toLowerCase()) {
      case "twilio":
        return await sendViaTwilio(mobile, otp);
      case "msg91":
        return await sendViaMsg91(mobile, otp);
      case "fast2sms":
        return await sendViaFast2SMS(mobile, otp);
      default:
        logger.warn(
          `Unknown SMS provider: ${SMS_PROVIDER}. Falling back to console log.`,
        );
        console.log(`📱 OTP for ${mobile}: ${otp}`);
        return { success: true, message: "Sent via fallback" };
    }
  } catch (error) {
    logger.error(`SMS sending failed: ${error.message}`);
    // Don't throw - log the error but return OTP in dev mode
    if (process.env.NODE_ENV === "development") {
      console.log(`\n⚠️ SMS failed, but here's your OTP: ${otp}\n`);
      return { success: true, message: "Fallback to console (SMS failed)" };
    }
    throw error;
  }
};

/**
 * Twilio SMS Integration
 * Sign up: https://www.twilio.com/
 * Required env vars:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */
const sendViaTwilio = async (mobile, otp) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not configured in .env");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  // Format mobile for international use
  const formattedMobile = mobile.startsWith("+") ? mobile : `+91${mobile}`;

  const message = `Your Pre-Canteen OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;

  try {
    const response = await axios.post(
      url,
      new URLSearchParams({
        To: formattedMobile,
        From: fromNumber,
        Body: message,
      }),
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    logger.info(`Twilio SMS sent to ${mobile}: ${response.data.sid}`);
    return {
      success: true,
      message: "SMS sent via Twilio",
      sid: response.data.sid,
    };
  } catch (error) {
    console.log("========== TWILIO ERROR ==========");
    console.dir(error.response?.data, { depth: null });
    console.log("==================================");

    logger.error(
      `Twilio error: ${JSON.stringify(error.response?.data, null, 2)}`,
    );

    throw new Error("Failed to send SMS via Twilio");
  }
};

/**
 * MSG91 SMS Integration (Popular in India)
 * Sign up: https://msg91.com/
 * Required env vars:
 * - MSG91_AUTH_KEY
 * - MSG91_SENDER_ID (optional, defaults to "MSGIND")
 * - MSG91_TEMPLATE_ID (optional)
 */
const sendViaMsg91 = async (mobile, otp) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || "MSGIND";
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY not configured in .env");
  }

  const url = "https://api.msg91.com/api/v5/otp";

  try {
    const payload = {
      template_id: templateId,
      mobile: `91${mobile}`, // Add country code
      authkey: authKey,
      otp: otp,
      // Optional: If using template variables
      // otp_expiry: "5",
    };

    // If no template, use direct SMS
    if (!templateId) {
      const message = `Your Pre-Canteen OTP is ${otp}. Valid for 5 minutes. Do not share.`;
      payload.message = message;
      payload.sender = senderId;
    }

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
    });

    logger.info(`MSG91 SMS sent to ${mobile}: ${response.data.type}`);
    return { success: true, message: "SMS sent via MSG91" };
  } catch (error) {
    logger.error(`MSG91 error: ${error.response?.data || error.message}`);
    throw new Error("Failed to send SMS via MSG91");
  }
};

/**
 * Fast2SMS Integration (Free tier available)
 * Sign up: https://www.fast2sms.com/
 * Required env vars:
 * - FAST2SMS_API_KEY
 */
const sendViaFast2SMS = async (mobile, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    throw new Error("FAST2SMS_API_KEY not configured in .env");
  }

  const url = "https://www.fast2sms.com/dev/bulkV2";

  const message = `Your Pre-Canteen OTP is ${otp}. Valid for 5 minutes.`;

  try {
    const response = await axios.post(
      url,
      new URLSearchParams({
        authorization: apiKey,
        route: "v3",
        sender_id: "TXTIND",
        message: message,
        language: "english",
        flash: "0",
        numbers: mobile,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (response.data.return === false) {
      throw new Error(response.data.message || "Fast2SMS API error");
    }

    logger.info(`Fast2SMS sent to ${mobile}: ${response.data.request_id}`);
    return { success: true, message: "SMS sent via Fast2SMS" };
  } catch (error) {
    logger.error(`Fast2SMS error: ${error.response?.data || error.message}`);
    throw new Error("Failed to send SMS via Fast2SMS");
  }
};

/**
 * Utility: Validate Indian mobile number
 */
export const isValidIndianMobile = (mobile) => {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
};

export default { sendOtpSms, isValidIndianMobile };
