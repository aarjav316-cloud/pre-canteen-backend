import Notification from "../models/Notification.js";

export const getMyNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
        res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json({ success: true, message: "Marked all as read" });
    } catch (error) {
        next(error);
    }
};
