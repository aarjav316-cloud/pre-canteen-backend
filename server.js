import express from 'express'
import dotenv from "dotenv"
import cors from "cors"
import morgan from "morgan"
import authRoutes from "./src/routes/authRoutes.js"


import connectDb from './src/config/db.js'
import { connectRedis } from './src/config/redis.js'
import errorHandler from './src/middleware/errorMiddleware.js'
import logger from './src/utils/logger.js'
import menuRoutes from "./src/routes/menuRoutes.js"
import orderRoutes from "./src/routes/orderRoute.js"


dotenv.config()


const app = express();


connectDb()
connectRedis()



app.use(cors())
app.use(express.json())
app.use(morgan("dev"))


app.use("/api/auth" , authRoutes)
app.use("/api/menu" , menuRoutes)
app.use("/api/orders" , orderRoutes)


app.get("/health" , (req , res) => {
    res.status(200).json({
        success:true,
        message:"Server running properly"
    });
});

app.use(errorHandler);


const PORT = process.env.PORT || 5000;


const server = app.listen(  process.env.PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});


process.on("SIGINT", async () => {
    logger.warn("Shutting down server...");
    server.close(() => {
      logger.info("Server closed.");
      process.exit(0);
    });
});


