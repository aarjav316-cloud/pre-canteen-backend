import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";
import { redisClient } from "../config/redis.js";

export const login = async (req, res, next) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Insufficient details",
      });
    }

    // Validate Indian mobile number
    const mobileRegex = /^[6-9]\d{9}$/;

    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    const loginKey = `login_attempt:${mobile}`;

    const attempts = await redisClient.get(loginKey);

    if (attempts && parseInt(attempts) >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Try again later.",
      });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      await increamentLoginAttempts(loginKey);

      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Please login using Google",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await increamentLoginAttempts(loginKey);

      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    await redisClient.del(loginKey);

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

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    next(error);
  }
};

const increamentLoginAttempts = async (key) => {
  const attempts = await redisClient.incr(key);

  if (attempts === 1) {
    await redisClient.expire(key, 60);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const {
      name,
      currentPassword,
      newPassword,
      dp,
      mobile,
      notificationPreferences,
      refundPreference,
    } = req.body;

    if (name !== undefined) user.name = name;
    if (dp !== undefined) user.dp = dp;
    // College field is immutable - cannot be updated
    if (mobile !== undefined) user.mobile = mobile;

    if (notificationPreferences !== undefined) {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    if (
      refundPreference !== undefined &&
      ["wallet", "original"].includes(refundPreference)
    ) {
      user.refundPreference = refundPreference;
    }

    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        res.status(400);
        throw new Error("Invalid current password");
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        name: user.name,
        mobile: user.mobile,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        dp: user.dp,
        college: user.college,
        notificationPreferences: user.notificationPreferences,
        refundPreference: user.refundPreference,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    await user.deleteOne();
    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
