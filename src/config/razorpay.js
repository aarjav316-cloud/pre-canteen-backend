import Razorpay from "razorpay";

let razorpay = null;

if (
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_ID !== "your_test_key" &&
  process.env.RAZORPAY_KEY_SECRET &&
  process.env.RAZORPAY_KEY_SECRET !== "your_test_secret"
) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log("âœ“ Razorpay initialized");
} else {
  console.warn("âš  Razorpay not initialized - using placeholder credentials");
}

export default razorpay;
