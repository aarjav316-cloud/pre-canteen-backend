import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const protect = async (req,res,next) => {
    try {

      let token;

      if(
        req.headers.Authorization &&
        req.headers.Authorization.startsWith("Bearer")
      ){
        token = req.headers.Authorization
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      req.user = await User.findById(decoded.id).select("-password")

      next()
        
    } catch (error) {
        res.status(401)
        next(error)
    }
}

export const authorizeRoles = (...roles) => {
     return (req,res,next) => {
        if(!roles.includes(req.user.role)){
            throw new Error("Access denied: inssufficient permissions")
        }
        next()
     }
}


