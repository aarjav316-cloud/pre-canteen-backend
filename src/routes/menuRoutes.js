import express from 'express'
import { 
    addMenuItems, 
    deleteMenu, 
    getAllMenu,
    searchMenu,
    toggleAvailability,
    updatedMenu
} from '../controllers/menuController.js'

import { authorizeRoles , protect } from '../middleware/authMiddleware.js'


const router = express.Router();

router.get("/" , getAllMenu)
router.get("/search" , searchMenu)

router.post("/" , protect , authorizeRoles("admin") , addMenuItems)

router.put("/:id" , protect , authorizeRoles("admin") , updatedMenu)
router.delete("/:id" , protect , authorizeRoles("admin") , deleteMenu)
router.patch("/:id/toggle" , protect , authorizeRoles("admin") , toggleAvailability)



export default router