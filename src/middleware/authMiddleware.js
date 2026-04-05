import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      res.status(401);
      throw new Error("Not authorized, token missing");
    }

    console.log("Verifying token...");
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
    console.log("Token length:", token?.length);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decoded, user ID:", decoded.id);

    req.user = await User.findById(decoded.id).select("-password");
    console.log("User found:", req.user ? "Yes" : "No");

    if (!req.user) {
      res.status(401);
      throw new Error("User not found");
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    console.error("Error name:", error.name);

    // Set proper status code for auth errors
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.message === "Not authorized, token missing" ||
      error.message === "User not found"
    ) {
      res.status(401);
    } else if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }

    next(error);
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new Error("Access denied: inssufficient permissions");
    }
    next();
  };
};
