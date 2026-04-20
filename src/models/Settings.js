import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
    canteenName: {
        type: String,
        default: "Admin Canteen",
        trim: true
    },
    collegeName: {
        type: String,
        default: "SRM Institute of Science and Technology",
        trim: true
    },
    canteenDP: {
        type: String,
        default: ""
    },
    isOpen: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
