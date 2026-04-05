import Razorpay from "razorpay";

let razorpay = null;

// Only initialize Razorpay if valid credentials are provided
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
  console.log("✓ Razorpay initialized");
} else {
  console.warn("⚠ Razorpay not initialized - using placeholder credentials");
}

export default razorpay;
