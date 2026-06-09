import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Generates a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt for uniform distribution (no modulo bias).
 * @returns {string} 6-digit OTP string
 */
export const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hashes an OTP using bcrypt before storing in DB.
 * @param {string} otp - Plain text OTP
 * @returns {Promise<string>} Hashed OTP
 */
export const hashOtp = async (otp) => {
  return await bcrypt.hash(otp, 10);
};

/**
 * Compares a plain OTP against its bcrypt hash.
 * @param {string} otp - Plain text OTP from user input
 * @param {string} hashedOtp - Stored bcrypt hash
 * @returns {Promise<boolean>}
 */
export const verifyOtp = async (otp, hashedOtp) => {
  return await bcrypt.compare(otp, hashedOtp);
};
