import express from 'express'
import { createOrder , 
    getMyOrders ,
    getAllOrders , 
    updateOrderStatus , 
    verifyPickUpCode,
    createPayment,
    verifyPayment,
    getRevenueByDay,
    getRevenueByMonth,
    getTopSellingItems,
    getOrderStatusSummary
} from '../controllers/orderController.js'

import { protect , authorizeRoles } from '../middleware/authMiddleware.js'


const router = express.Router()

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create order from cart (Student only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Order created successfully
 */

router.post("/" , protect , authorizeRoles("student") , createOrder)

/**
 * @swagger
 * /api/orders/my:
 *   get:
 *     summary: Get logged-in user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user orders
 */

router.get("/my", protect, authorizeRoles("student"), getMyOrders);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All orders retrieved
 */

// Admin
router.get("/", protect, authorizeRoles("admin"), getAllOrders);

/**
 * @swagger
 * /api/orders/{orderId}/status:
 *   patch:
 *     summary: Update order status (Admin/Staff)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order status updated
 */

router.patch("/:orderId/status", protect, authorizeRoles("admin", "staff"), updateOrderStatus);

/**
 * @swagger
 * /api/orders/{orderId}/verify:
 *   post:
 *     summary: Verify pickup code (Staff only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pickup verified and order completed
 */

// Staff
router.post("/:orderId/verify", protect, authorizeRoles("staff"), verifyPickUpCode);

/**
 * @swagger
 * /api/orders/{orderId}/pay:
 *   post:
 *     summary: Create Razorpay payment order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Razorpay order created
 */

router.post("/:orderId/pay" , protect , authorizeRoles("student") , createPayment )

/**
 * @swagger
 * /api/orders/verify-payment:
 *   post:
 *     summary: Verify Razorpay payment signature
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment verified successfully
 */

router.post("/verify-payment" , protect , verifyPayment)

/**
 * @swagger
 * /api/orders/analytics/revenue-day:
 *   get:
 *     summary: Get revenue grouped by day (Admin)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue by day
 */



router.get("/analytics/revenue-day",protect,authorizeRoles("admin"),getRevenueByDay)

/**
 * @swagger
 * /api/orders/analytics/revenue-month:
 *   get:
 *     summary: Get revenue grouped by month (Admin)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue by month
 */

router.get("/analytics/revenue-month",protect,authorizeRoles("admin"),getRevenueByMonth)

/**
 * @swagger
 * /api/orders/analytics/top-items:
 *   get:
 *     summary: Get top selling items (Admin)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Top selling menu items
 */


router.get("/analytics/top-items",protect,authorizeRoles("admin"), getTopSellingItems)

/**
 * @swagger
 * /api/orders/analytics/status-summary:
 *   get:
 *     summary: Get order count grouped by status (Admin)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order status summary
 */

router.get("/analytics/status-summary",protect,authorizeRoles("admin"),getOrderStatusSummary)


export default router;



