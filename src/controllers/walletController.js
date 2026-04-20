import crypto from "crypto";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Notification from "../models/Notification.js";
import razorpay from "../config/razorpay.js";

// Direct add (testing only — no payment gateway)
export const addMoney = async (req, res, next) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.walletBalance += amount;
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id, amount, type: "credit",
            description: "Wallet recharge", status: "success"
        });

        res.status(200).json({ success: true, walletBalance: user.walletBalance, transaction });
    } catch (error) { next(error); }
};

// Step 1 — Create a Razorpay order for wallet top-up
export const createWalletOrder = async (req, res, next) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0 || isNaN(amount)) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        if (!razorpay) {
            return res.status(503).json({ success: false, message: "Payment gateway not configured" });
        }

        const options = {
            amount: Math.round(amount * 100), // paise
            currency: "INR",
            receipt: `wallet_${req.user._id}_${Date.now()}`,
            notes: {
                userId: req.user._id.toString(),
                purpose: "wallet_topup"
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            razorpayOrderId: order.id,
            amount: order.amount,
            currency: order.currency,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        next(error);
    }
};

// Step 2 — Verify payment signature and credit wallet
export const verifyWalletPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing payment details" });
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        // Check not already credited (idempotency)
        const existing = await Transaction.findOne({ razorpayPaymentId: razorpay_payment_id });
        if (existing) {
            const user = await User.findById(req.user._id);
            return res.status(200).json({ success: true, message: "Already credited", walletBalance: user.walletBalance });
        }

        const creditAmount = amount / 100; // convert paise back to rupees

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.walletBalance += creditAmount;
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            amount: creditAmount,
            type: "credit",
            description: "Wallet recharge via Razorpay",
            status: "success",
            razorpayPaymentId: razorpay_payment_id
        });

        await Notification.create({
            user: user._id,
            title: "Wallet Recharged",
            message: `₹${creditAmount} added to your wallet via Razorpay.`,
            type: "wallet"
        });

        res.status(200).json({
            success: true,
            message: "Wallet credited successfully",
            walletBalance: user.walletBalance,
            transaction
        });

    } catch (error) {
        next(error);
    }
};

// Get wallet balance and transaction history
export const getWalletData = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const transactions = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50);

        res.status(200).json({
            success: true,
            walletBalance: user.walletBalance,
            transactions
        });

    } catch (error) {
        next(error);
    }
};
