import mongoose from "mongoose";

const orderSchema  = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
        index:true
    },

    items: [
        {
            menu:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Menu",
                required:true
            },
            name:String,
            price:Number,
            quantity:Number
        },
    ],

    totalAmount: {
        type:Number,
        required:true
    },

    pickupCode:{
        type:String,
        required:true
    },

    status:{
        type:String,
        enum: [
            "pending",
            "paid",
            "preparing",
            "ready",
            "completed",
            "cancelled",
        ],

        default:"pending",
        index:true
    },

    razorpayOrderId: {
        type:String,
    },

    razorpayPaymentId: {
        type:String,
    },

    isPaid:{
        type:Boolean,
        default:false,
    },
},
 {timestamps:true}
);

const Order = mongoose.model("Order" , orderSchema);

export default Order








