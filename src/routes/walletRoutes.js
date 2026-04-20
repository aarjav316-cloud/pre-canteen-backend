import express from "express";
import { addMoney, createWalletOrder, verifyWalletPayment, getWalletData } from "../controllers/walletController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getWalletData);
router.post("/add", addMoney);              // direct add (testing)
router.post("/create-order", createWalletOrder);   // razorpay step 1
router.post("/verify", verifyWalletPayment);        // razorpay step 2

export default router;
