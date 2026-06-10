import User from "../models/User.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";
import { generateOtp, hashOtp, verifyOtp } from "../utils/otpHelper.js";
import { sendOtpSms } from "../utils/smsService.js";

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * POST /api/auth/forgot-password/send-otp
 * Send OTP to registered mobile number for password reset
 */
export const sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    // Validate mobile format
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number. Must be 10 digits starting with 6-9",
      });
    }

    // Check if user exists
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Mobile number not registered",
      });
    }

    // Check if user has a password (not Google OAuth user)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account uses Google login. Password reset not available.",
      });
    }

    // Check for OTP cooldown
    const existingOtp = await Otp.findOne({ mobile });
    if (existingOtp) {
      const secondsSinceLastSend =
        (Date.now() - new Date(existingOtp.lastSentAt).getTime()) / 1000;

      if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
        const waitTime = Math.ceil(
          RESEND_COOLDOWN_SECONDS - secondsSinceLastSend,
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting a new OTP`,
          retryAfter: waitTime,
        });
      }
    }

    // Generate and hash OTP
    const otp = generateOtp();
    const hashedOtpValue = await hashOtp(otp);

    // Store OTP with a flag to indicate it's for password reset
    await Otp.findOneAndUpdate(
      { mobile },
      {
        mobile,
        name: user.name,
        otp: hashedOtpValue,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        lastSentAt: new Date(),
        isForgotPassword: true, // Flag for password reset
      },
      { upsert: true, new: true },
    );

    // Send OTP via SMS
    try {
      await sendOtpSms(mobile, otp);
      logger.info(`Forgot password OTP sent to ${mobile}`);
    } catch (smsError) {
      logger.error(`SMS sending failed for ${mobile}: ${smsError.message}`);
      if (process.env.NODE_ENV !== "development") {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent to your mobile number. Valid for 5 minutes.",
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verify OTP (but don't reset password yet)
 */
export const verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required",
      });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({ mobile, isForgotPassword: true });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new one.",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(otp, otpRecord.otp);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    // OTP is valid, but don't delete it yet
    // Mark it as verified so it can be used for password reset
    otpRecord.verified = true;
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now reset your password.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/reset
 * Reset password after OTP verification
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mobile number, OTP, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Find and verify OTP record
    const otpRecord = await Otp.findOne({ mobile, isForgotPassword: true });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new one.",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(otp, otpRecord.otp);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // Find user
    const user = await User.findOne({ mobile });

    if (!user) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Delete OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    logger.info(`Password reset successful for ${mobile}`);

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/resend-otp
 * Resend OTP for password reset
 */
export const resendForgotPasswordOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    // Check if OTP record exists
    const otpRecord = await Otp.findOne({ mobile, isForgotPassword: true });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "No pending password reset found. Please start again.",
      });
    }

    // Enforce cooldown
    const secondsSinceLastSend =
      (Date.now() - new Date(otpRecord.lastSentAt).getTime()) / 1000;

    if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(
        RESEND_COOLDOWN_SECONDS - secondsSinceLastSend,
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitTime} seconds before resending`,
        retryAfter: waitTime,
      });
    }

    // Generate new OTP
    const otp = generateOtp();
    const hashedOtpValue = await hashOtp(otp);

    otpRecord.otp = hashedOtpValue;
    otpRecord.expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    otpRecord.lastSentAt = new Date();
    otpRecord.verified = false;

    await otpRecord.save();

    // Send OTP via SMS
    try {
      await sendOtpSms(mobile, otp);
      logger.info(`Forgot password OTP resent to ${mobile}`);
    } catch (smsError) {
      logger.error(`SMS resend failed for ${mobile}: ${smsError.message}`);
      if (process.env.NODE_ENV !== "development") {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "New OTP sent to your mobile number.",
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    next(error);
  }
};
