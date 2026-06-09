import crypto from "crypto";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Notification from "../models/Notification.js";
import razorpay from "../config/razorpay.js";

export const addMoney = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });

    const user = await User.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.walletBalance += amount;
    await user.save();

    const transaction = await Transaction.create({
      userId: user._id,
      amount,
      type: "credit",
      description: "Wallet recharge",
      status: "success",
    });

    res
      .status(200)
      .json({ success: true, walletBalance: user.walletBalance, transaction });
  } catch (error) {
    next(error);
  }
};

export const createWalletOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;

    console.log("📝 Create wallet order request - Amount:", amount);
    console.log(
      "💳 Razorpay status:",
      razorpay ? "✅ Initialized" : "❌ Not initialized",
    );

    if (!amount || amount <= 0 || isNaN(amount)) {
      res.status(400);
      throw new Error("Invalid amount");
    }

    if (!razorpay) {
      res.status(503);
      throw new Error(
        "Payment gateway not configured. Please check Razorpay credentials.",
      );
    }

    const options = {
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `wlt_${Date.now()}`, // Shortened receipt
      notes: {
        userId: req.user._id.toString(),
        purpose: "wallet_topup",
      },
    };

    console.log("🔄 Creating Razorpay order...");
    const order = await razorpay.orders.create(options);
    console.log("✅ Razorpay order created:", order.id);

    res.status(200).json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("❌ Create wallet order error:", error);

    // Handle Razorpay-specific errors
    if (error.error && error.error.description) {
      const err = new Error(error.error.description);
      err.statusCode = error.statusCode || 500;
      return next(err);
    }

    next(error);
  }
};

export const verifyWalletPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Missing payment details" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }

    const existing = await Transaction.findOne({
      razorpayPaymentId: razorpay_payment_id,
    });
    if (existing) {
      const user = await User.findById(req.user._id);
      return res.status(200).json({
        success: true,
        message: "Already credited",
        walletBalance: user.walletBalance,
      });
    }

    const creditAmount = amount / 100; // convert paise back to rupees

    const user = await User.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.walletBalance += creditAmount;
    await user.save();

    const transaction = await Transaction.create({
      userId: user._id,
      amount: creditAmount,
      type: "credit",
      description: "Wallet recharge via Razorpay",
      status: "success",
      razorpayPaymentId: razorpay_payment_id,
    });

    await Notification.create({
      user: user._id,
      title: "Wallet Recharged",
      message: `â‚¹${creditAmount} added to your wallet via Razorpay.`,
      type: "wallet",
    });

    res.status(200).json({
      success: true,
      message: "Wallet credited successfully",
      walletBalance: user.walletBalance,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const getWalletData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      walletBalance: user.walletBalance,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};
