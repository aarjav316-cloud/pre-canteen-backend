import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ["credit", "debit"],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["success", "failed", "pending"],
        default: "success"
    },
    razorpayPaymentId: {
        type: String,
        default: null,
        index: true,
        sparse: true
    }
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;
