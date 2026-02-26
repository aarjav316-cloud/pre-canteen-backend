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

router.post("/" , protect , authorizeRoles("student") , createOrder)

router.get("/my", protect, authorizeRoles("student"), getMyOrders);

// Admin
router.get("/", protect, authorizeRoles("admin"), getAllOrders);
router.patch("/:orderId/status", protect, authorizeRoles("admin", "staff"), updateOrderStatus);

// Staff
router.post("/:orderId/verify", protect, authorizeRoles("staff"), verifyPickUpCode);


router.post("/:orderId/pay" , protect , authorizeRoles("student") , createPayment )
router.post("/verify-payment" , protect , verifyPayment)


router.get("/analytics/revenue-day",protect,authorizeRoles("admin"),getRevenueByDay)
router.get("/analytics/revenue-month",protect,authorizeRoles("admin"),getRevenueByMonth)
router.get("/analytics/top-items",protect,authorizeRoles("admin"), getTopSellingItems)
router.get("/analytics/status-summary",protect,authorizeRoles("admin"),getOrderStatusSummary)


export default router;


