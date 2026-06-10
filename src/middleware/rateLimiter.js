import rateLimit from "express-rate-limit";

/**
 * Rate limiter for OTP-related endpoints (register, resend-otp).
 * Limits each IP + mobile combo to 5 OTP requests per 15-minute window.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 requests per window per IP
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again after 15 minutes.",
  },
  // Remove custom keyGenerator to use default IP-based rate limiting
  // This properly handles both IPv4 and IPv6
});

/**
 * Rate limiter for OTP verification attempts.
 * Limits each IP to 10 verification attempts per 15-minute window.
 */
export const verifyOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
});
