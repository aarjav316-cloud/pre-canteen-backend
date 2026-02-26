import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";

import connectDb from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";

import authRoutes from "./src/routes/authRoutes.js";
import menuRoutes from "./src/routes/menuRoutes.js";
import orderRoutes from "./src/routes/orderRoute.js";
import cartRoutes from "./src/routes/cartRoutes.js";

import errorHandler from "./src/middleware/errorMiddleware.js";
import logger from "./src/utils/logger.js";

import { initSocket } from "./src/config/socket.js";
import { Socket } from "net";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;



app.use(cors());
app.use(express.json());
app.use(morgan("dev"));



app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server running properly",
  });
});


app.use(errorHandler);

/* -------------------- HTTP + SOCKET -------------------- */

const httpServer = http.createServer(app)

const io = new Server(httpServer , {
    cors: {
        origin:"*",
    },
})

initSocket(io)


io.on("connection" , (socket) => {

    logger.info("Client connected: "  + socket.id)

    socket.on("join_user_room" , (userId) => {
        socket.join(`user_${userId}`);
    })

    socket.on("join_admin_dashboard" , () => {
        socket.join("admin_dashboard")
    })

    socket.on("join_kitchen_room" , () => {
        socket.join("kitchen_room")
    })

    socket.on("disconnect" , () => {
        logger.warn("Client disconnected: " + socket.id)
    })

})
/* -------------------- START SERVER SAFELY -------------------- */

const startServer = async () => {
  try {
    await connectDb();
    await connectRedis();

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server: " + error.message);
    process.exit(1);
  }
};

startServer();



process.on("SIGINT", () => {
  logger.warn("Shutting down server...");

  httpServer.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  logger.warn("SIGTERM received. Closing server...");

  httpServer.close(() => {
    logger.info("Server terminated.");
    process.exit(0);
  });
});




