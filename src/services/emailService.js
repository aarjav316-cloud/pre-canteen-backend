import nodemailer from "nodemailer";
import logger from "../utils/logger.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    logger.error(`Email transporter verification failed: ${error.message}`);
  } else {
    logger.info("Email transporter is ready to send emails");
  }
});

/**
 * Sends an OTP verification email with a styled HTML template.
 * @param {string} to - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 * @param {string} name - Recipient's name for personalization
 */
export const sendOtpEmail = async (to, otp, name) => {
  const mailOptions = {
    from: `"PreCanteen" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify Your Email — PreCanteen",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8f9fa; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">PreCanteen</h1>
          <p style="color: #6c757d; font-size: 14px; margin-top: 4px;">Email Verification</p>
        </div>
        <div style="background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px;">Hi <strong>${name}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Use the OTP below to verify your email address. It expires in <strong>5 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #1a1a2e; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 10px; padding: 14px 28px; border-radius: 8px;">
              ${otp}
            </span>
          </div>
          <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <p style="color: #adb5bd; font-size: 11px; text-align: center; margin-top: 20px;">
          &copy; ${new Date().getFullYear()} PreCanteen. All rights reserved.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`OTP email sent to ${to}`);
};
