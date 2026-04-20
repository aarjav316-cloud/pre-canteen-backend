import mongoose from "mongoose";

const menuSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true,
        index:true
    },

    description:{
        type:String,
        required:true,
        trim:true
    },
    image: {
        type: String,
        default: ""
    },
    price:{
        type:Number,
        required:true,
        min:0,
    },
    category:{
        type:String,
        required:true,
        index:true
    },
    isAvailable: {
        type:Boolean,
        default:true,
        index:true
    }
}, {timestamps:true})


menuSchema.index({name:"text" , description:"text"})


const Menu = mongoose.model('Menu' , menuSchema)

export default Menu;



