import express from "express"

import { addToCart , getCart , 
    removeCart , clearCart
 } from "../controllers/cartController.js"



import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/cart/add:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - menuId
 *               - quantity
 *             properties:
 *               menuId:
 *                 type: string
 *                 example: 65fabc1234567890
 *               quantity:
 *                 type: number
 *                 example: 2
 *     responses:
 *       200:
 *         description: Item added to cart
 */

router.post("/add" , protect , addToCart)


/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get current user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 */


router.get("/" , protect , getCart)

/**
 * @swagger
 * /api/cart/remove:
 *   post:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - menuId
 *             properties:
 *               menuId:
 *                 type: string
 *                 example: 65fabc1234567890
 *     responses:
 *       200:
 *         description: Item removed from cart
 */

router.post("/remove" , protect , removeCart)

/**
 * @swagger
 * /api/cart/clear:
 *   post:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 */

router.post("/clear" , protect , clearCart)

export default router;
