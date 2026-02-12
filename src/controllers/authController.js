import User from "../models/User.js";
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import logger from "../utils/logger.js";


export const register = async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
  
      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Insufficient credentials",
        });
      }
  
      // Check existing user
      const existingUser = await User.findOne({ email });
  
      if (existingUser) {
        res.status(400);
        throw new Error("User already exists");
      }
  
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create user
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
      });
  
      return res.status(201).json({
        success: true,
        message: "User successfully created",
        userId: user._id,
      });
  
    } catch (error) {
      next(error);
    }
  };
  
  export const login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Insufficient details",
        });
      }
  
      const user = await User.findOne({ email });
  
      if (!user) {
        res.status(400);
        throw new Error("User does not exist");
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        res.status(400);
        throw new Error("Invalid credentials");
      }
  
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
  
      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
      });
  
    } catch (error) {
      next(error);
    }
  };
  