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
  
      const token = jwt.sign(
        { id: user._id, role: user.role, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.status(201).json({
        success: true,
        message: "User successfully created",
        userId: user._id,
        token
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
        { id: user._id, role: user.role, name: user.name, email: user.email },
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

  export const updateProfile = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user) {
        res.status(404);
        throw new Error("User not found");
      }

      const { 
        name, currentPassword, newPassword,
        dp, college, mobile, notificationPreferences
      } = req.body;

      if (name !== undefined) user.name = name;
      if (dp !== undefined) user.dp = dp;
      if (college !== undefined) user.college = college;
      if (mobile !== undefined) user.mobile = mobile;
      if (notificationPreferences !== undefined) {
         user.notificationPreferences = {
            ...user.notificationPreferences,
            ...notificationPreferences
         };
      }

      if (currentPassword && newPassword) {
         const isMatch = await bcrypt.compare(currentPassword, user.password);
         if (!isMatch) {
            res.status(400);
            throw new Error("Invalid current password");
         }
         user.password = await bcrypt.hash(newPassword, 10);
      }

      await user.save();
      
      const token = jwt.sign(
        { id: user._id, role: user.role, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.status(200).json({
         success: true,
         message: "Profile updated successfully",
         token,
         user: {
           _id: user._id,
           name: user.name,
           email: user.email,
           role: user.role,
           dp: user.dp,
           college: user.college,
           mobile: user.mobile,
           notificationPreferences: user.notificationPreferences
         }
      });
    } catch (error) {
      next(error);
    }
  };

  export const getProfile = async (req, res, next) => {
    try {
       const user = await User.findById(req.user._id).select('-password');
       if (!user) {
          res.status(404);
          throw new Error("User not found");
       }
       res.status(200).json({
          success: true,
          user
       });
    } catch (error) {
       next(error);
    }
  };

  export const deleteAccount = async (req, res, next) => {
    try {
       const user = await User.findById(req.user._id);
       if (!user) {
          res.status(404);
          throw new Error("User not found");
       }
       await user.deleteOne();
       res.status(200).json({
          success: true,
          message: "Account deleted successfully"
       });
    } catch (error) {
       next(error);
    }
  };
