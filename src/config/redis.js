import { createClient } from "redis";
import logger from "../utils/logger.js";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    logger.info("Redis connected successfully");
  } catch (error) {
    logger.error(`Redis connection failed: ${error.message}`);
  }
};

redisClient.on("error", (err) => {
  logger.error(`Redis Client Error: ${err.message}`);
});

export { redisClient, connectRedis };

