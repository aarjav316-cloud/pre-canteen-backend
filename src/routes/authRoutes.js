import express from 'express';
import { register, login, updateProfile, getProfile, deleteAccount } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();



router.post("/register" , register);




router.post("/login" , login)

router.patch("/profile", protect, updateProfile);
router.get("/profile", protect, getProfile);
router.delete("/profile", protect, deleteAccount);

export default router;

