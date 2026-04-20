import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getSettings)
    .patch(protect, authorizeRoles('admin'), updateSettings);

export default router;
