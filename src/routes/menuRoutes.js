import express from 'express'
import { 
    addMenuItems, 
    deleteMenu, 
    getAllMenu,
    getMenuStats,
    searchMenu,
    toggleAvailability,
    updatedMenu
} from '../controllers/menuController.js'

import { authorizeRoles , protect } from '../middleware/authMiddleware.js'


const router = express.Router();

/**
 * @swagger
 * /api/menu:
 *   get:
 *     summary: Get all menu items
 *     tags: [Menu]
 *     responses:
 *       200:
 *         description: List of menu items
 */


router.get("/" , getAllMenu)

/**
 * @swagger
 * /api/menu/search:
 *   get:
 *     summary: Search menu items
 *     tags: [Menu]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Keyword to search menu items
 *     responses:
 *       200:
 *         description: Filtered menu items
 */

router.get("/search" , searchMenu)

/**
 * @swagger
 * /api/menu:
 *   post:
 *     summary: Create new menu item (Admin only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 example: Burger
 *               price:
 *                 type: number
 *                 example: 120
 *               category:
 *                 type: string
 *                 example: Fast Food
 *     responses:
 *       201:
 *         description: Menu created successfully
 */

router.post("/" , protect , authorizeRoles("admin") , addMenuItems)

/**
 * @swagger
 * /api/menu/{id}:
 *   put:
 *     summary: Update menu item (Admin only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu ID
 *     responses:
 *       200:
 *         description: Menu updated successfully
 */



router.put("/:id" , protect , authorizeRoles("admin") , updatedMenu)

/**
 * @swagger
 * /api/menu/{id}:
 *   delete:
 *     summary: Delete menu item (Admin only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu deleted successfully
 */

router.delete("/:id" , protect , authorizeRoles("admin") , deleteMenu)

/**
 * @swagger
 * /api/menu/{id}/toggle:
 *   patch:
 *     summary: Toggle menu availability (Admin only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability toggled successfully
 */

router.patch("/:id/toggle" , protect , authorizeRoles("admin") , toggleAvailability)


/**
 * @swagger
 * /api/menu/stats:
 *   get:
 *     summary: Get menu statistics (Admin only)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Menu statistics retrieved
 */


router.get("/stats" , protect , authorizeRoles("admin") , getMenuStats)

export default router;








