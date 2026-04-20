import Settings from "../models/Settings.js";
import { redisClient } from "../config/redis.js";

// @desc    Get global Settings
// @route   GET /api/settings
// @access  Public (or could be Admin only, but usually all need canteenName)
export const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();
        
        // Ensure settings exist (Singleton)
        if (!settings) {
            settings = await Settings.create({});
        }

        // Keep Redis cache synced with truth
        await redisClient.set("canteenOpen", settings.isOpen ? "true" : "false");

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Settings
// @route   PATCH /api/settings
// @access  Admin
export const updateSettings = async (req, res, next) => {
    try {
        const { canteenName, collegeName, canteenDP, isOpen } = req.body;

        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        if (canteenName !== undefined) settings.canteenName = canteenName;
        if (collegeName !== undefined) settings.collegeName = collegeName;
        if (canteenDP !== undefined) settings.canteenDP = canteenDP;
        if (isOpen !== undefined) {
           settings.isOpen = isOpen;
           // Rapidly sync redis so real-time clients can know instantly
           await redisClient.set("canteenOpen", isOpen ? "true" : "false");
           
           import("../config/socket.js").then(({ getIo }) => {
              const io = getIo();
              io.emit("canteen_status_update", { isOpen });
           });
        }

        await settings.save();

        res.status(200).json({
            success: true,
            message: "Settings updated successfully",
            data: settings
        });
    } catch (error) {
        next(error);
    }
};
