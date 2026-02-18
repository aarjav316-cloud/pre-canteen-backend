import express from "express"

import { addToCart , getCart , 
    removeCart , clearCart
 } from "../controllers/cartController.js"



import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add" , protect , addToCart)
router.get("/" , protect , getCart)
router.post("/remove" , protect , removeCart)
router.post("/clear" , protect , clearCart)

export default router;
