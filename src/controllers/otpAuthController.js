import User from "../models/User.js";
import Otp from "../models/Otp.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";
import { generateOtp, hashOtp, verifyOtp } from "../utils/otpHelper.js";
import { sendOtpSms } from "../utils/smsService.js";

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

// ─────────────────────────────────────────────────────────
// POST /api/auth/register  →  Send OTP (do NOT create user)
// ─────────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { name, mobile, password } = req.body;

    // 1) Validate input
    if (!name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, mobile number, and password are required",
      });
    }

    // Validate Indian mobile number (10 digits)
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number. Must be 10 digits starting with 6-9",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // 2) Check if mobile already registered
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Mobile number is already registered. Please log in.",
      });
    }

    // 3) Check resend cooldown (60s between OTP sends)
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

    // 4) Hash password & OTP
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const hashedOtpValue = await hashOtp(otp);

    // 5) Upsert into OTP collection (replace if already exists for this mobile)
    await Otp.findOneAndUpdate(
      { mobile },
      {
        mobile,
        name,
        password: hashedPassword,
        otp: hashedOtpValue,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        lastSentAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // 6) Send OTP via SMS
    try {
      await sendOtpSms(mobile, otp);
      logger.info(`OTP sent to ${mobile}`);
    } catch (smsError) {
      logger.error(`SMS sending failed for ${mobile}: ${smsError.message}`);
      // In production, you might want to fail the request if SMS fails
      // For now, we'll continue and return the OTP in dev mode
      if (process.env.NODE_ENV !== "development") {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "OTP sent to your mobile number. Please verify within 5 minutes.",
      otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only in dev
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/auth/verify-otp  →  Verify OTP & create user
// ─────────────────────────────────────────────────────────
export const verifyOtpAndRegister = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required",
      });
    }

    // 1) Find OTP record
    const otpRecord = await Otp.findOne({ mobile });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please register first.",
      });
    }

    // 2) Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });

      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // 3) Compare hashed OTP
    const isValid = await verifyOtp(otp, otpRecord.otp);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    // 4) Check if this is login or registration
    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      // LOGIN FLOW: User already exists
      await Otp.deleteOne({ _id: otpRecord._id });

      const token = jwt.sign(
        {
          id: existingUser._id,
          role: existingUser.role,
          name: existingUser.name,
          mobile: existingUser.mobile,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" },
      );

      logger.info(`User logged in via OTP: ${mobile}`);

      return res.status(200).json({
        success: true,
        message: "Login successful!",
        userId: existingUser._id,
        token,
      });
    }

    // REGISTRATION FLOW: New user
    if (!otpRecord.password) {
      // This shouldn't happen, but handle it gracefully
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: "Registration data incomplete. Please register again.",
      });
    }

    // 5) Create user
    const user = await User.create({
      name: otpRecord.name,
      mobile: otpRecord.mobile,
      password: otpRecord.password,
    });

    // 6) Delete OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    // 7) Issue JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        name: user.name,
        mobile: user.mobile,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    logger.info(`User registered via OTP: ${mobile}`);

    return res.status(201).json({
      success: true,
      message: "Mobile verified. Account created successfully!",
      userId: user._id,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/auth/resend-otp  →  Resend OTP with 60s cooldown
// ─────────────────────────────────────────────────────────

export const resendOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    // 1) Check if OTP record exists
    const otpRecord = await Otp.findOne({ mobile });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "No pending registration found. Please register first.",
      });
    }

    // 2) Enforce 60-second cooldown
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

    // 3) Check if user already exists
    const existingUser = await User.findOne({ mobile });

    if (existingUser) {
      await Otp.deleteOne({ _id: otpRecord._id });

      return res.status(409).json({
        success: false,
        message: "Mobile number is already registered. Please log in.",
      });
    }

    // 4) Generate new OTP
    const otp = generateOtp();
    const hashedOtpValue = await hashOtp(otp);

    otpRecord.otp = hashedOtpValue;
    otpRecord.expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    otpRecord.lastSentAt = new Date();

    await otpRecord.save();

    // Send OTP via SMS
    try {
      await sendOtpSms(mobile, otp);
      logger.info(`OTP resent to ${mobile}`);
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

// ─────────────────────────────────────────────────────────
// POST /api/auth/send-otp  →  Send OTP for login (existing users)
// ─────────────────────────────────────────────────────────
export const sendLoginOtp = async (req, res, next) => {
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
        message: "Mobile number not registered. Please sign up first.",
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

    // Store OTP (use user's name from DB, no password needed for login)
    await Otp.findOneAndUpdate(
      { mobile },
      {
        mobile,
        name: user.name, // Use existing user's name
        otp: hashedOtpValue,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        lastSentAt: new Date(),
        isLogin: true, // Flag to indicate this is for login, not registration
      },
      { upsert: true, new: true },
    );

    // Send OTP via SMS
    try {
      await sendOtpSms(mobile, otp);
      logger.info(`Login OTP sent to ${mobile}`);
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
