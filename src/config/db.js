import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDb = async () => {
    try {

        await mongoose.connect(process.env.MONGO_URI)
        logger.info("mongo db connected successfully")
        
    } catch (error) {
        
        logger.error(`mongo db connection failed ${error.message}`)
        process.exit(1)

    }
}


export default connectDb;






