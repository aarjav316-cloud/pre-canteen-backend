import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import {
  login,
  updateProfile,
  getProfile,
  deleteAccount,
} from "../controllers/authController.js";
import {
  register,
  verifyOtpAndRegister,
  resendOtp,
  sendLoginOtp,
} from "../controllers/otpAuthController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  otpRateLimiter,
  verifyOtpRateLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

// ── OTP-based Registration ──────────────────────────────
router.post("/register", otpRateLimiter, register); // Step 1: Send OTP
router.post("/verify-otp", verifyOtpRateLimiter, verifyOtpAndRegister); // Step 2: Verify & create user
router.post("/resend-otp", otpRateLimiter, resendOtp); // Resend OTP

// ── OTP-based Login (For existing users) ────────────────
router.post("/send-otp", otpRateLimiter, sendLoginOtp); // Send OTP for login
// Note: verify-otp endpoint handles both registration and login

// ── Password-based Login (Legacy/Staff) ─────────────────
router.post("/login", login);

// ── Google OAuth ────────────────────────────────────────
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    // Generate JWT token for the authenticated user
    const token = jwt.sign(
      {
        id: req.user._id,
        role: req.user.role,
        name: req.user.name,
        email: req.user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  },
);

// ── Profile (protected) ────────────────────────────────
router.patch("/profile", protect, updateProfile);
router.get("/profile", protect, getProfile);
router.delete("/profile", protect, deleteAccount);

export default router;
