import { createClient } from "redis";
import logger from "../utils/logger.js";

const redisClient = createClient({
    socket: {
        host:process.env.REDIS_HOST || "127.0.0.1",
        port:process.env.REDIS_PORT || 6379
    },
})


const connectRedis = async () => {
    try {

        await redisClient.connect()
        logger.info("Redis connected successfully");
        
    } catch (error) {
        logger.error(`Redis connection failed: ${error.message}`)
    }
}

redisClient.on("error" , (err) => {
    logger.error(`Redis Client Error: ${err.message}`)
});
 

export {redisClient , connectRedis};






































