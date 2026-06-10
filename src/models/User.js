import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    mobile: {
      type: String,
      required: function () {
        return !this.googleId; // Required only if not Google OAuth
      },
      sparse: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Required only if not Google OAuth
      },
      minLength: 6,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    authType: {
      type: String,
      enum: ["email", "google", "local"],
      default: "email",
    },
    role: {
      type: String,
      enum: ["student", "admin", "staff"],
      default: "student",
    },
    dp: {
      type: String,
      default: "",
    },
    college: {
      type: String,
      default: "MEDICAPS UNIVERSITY",
      immutable: true, // Cannot be changed after creation
    },

    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      menuReminders: { type: Boolean, default: true },
    },
    refundPreference: {
      type: String,
      enum: ["wallet", "original"],
      default: "wallet",
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
