import User from "../models/User.js";
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import logger from "../utils/logger.js";
import { redisClient } from "../config/redis.js";


export const register = async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
  
      
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Insufficient credentials",
        });
      }
  
      
      const existingUser = await User.findOne({ email });
  
      if (existingUser) {
        res.status(400);
        throw new Error("User already exists");
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      
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


      const loginKey = `login_attempt:${email}`;

      const attempts = await redisClient.get(loginKey)

      if(attempts && parseInt(attempts) >= 5) {
        res.status(429)
        throw new Error("too many login attempts. Try again later.")
      }
  
      const user = await User.findOne({ email: email.toLowerCase() });
  
      if (!user) {
        await increamentLoginAttempts(loginKey)
        
        throw new Error("invalid credentials");
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        await increamentLoginAttempts(loginKey)
        res.status(400);
        throw new Error("Invalid credentials");
      }

      await redisClient.del(loginKey)
  
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
  

  
  const increamentLoginAttempts = async(key) => {
    const attempts = await redisClient.incr(key);

    if(attempts === 1) {
        await redisClient.expire(key , 60)
    }
  }

