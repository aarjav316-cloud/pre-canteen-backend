import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        index:true
    },
    password:{
        type:String,
        required:true,
        minLength:6
    },
    role:{
        type:String,
        enum:["student","admin","staff"],
        default:"student"
    },
    dp: {
        type: String,
        default: ""
    },
    college: {
        type: String,
        default: "SRM Institute of Science and Technology"
    },
    mobile: {
        type: String,
        default: ""
    },
    notificationPreferences: {
        orderUpdates: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true },
        menuReminders: { type: Boolean, default: true }
    },
    walletBalance: {
        type: Number,
        default: 0
    }
},
{timestamps:true}
)


const User = mongoose.model('User' , userSchema)

export default User
