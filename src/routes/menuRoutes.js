import express from 'express'
import { 
    addMenuItems, 
    getAllMenu,
    searchMenu
} from '../controllers/menuController.js'

import { authorizeRoles , protect } from '../middleware/authMiddleware.js'


const router = express.Router();

router.get("/" , getAllMenu)
router.get("/search" , searchMenu)

router.post("/" , protect , authorizeRoles("admin") , addMenuItems)


export default router