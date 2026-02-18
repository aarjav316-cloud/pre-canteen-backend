import { redisClient } from "../config/redis.js";
import Menu from "../models/Menu.js";


const CART_TTL = 60*30;

export const addToCart = async (req,res,next) => {
    try {
      const userId = req.user._id.toString();
      const { menuId, quantity } = req.body;
  
      if (!menuId || !quantity) {
        res.status(400);
        throw new Error("menuId and quantity required");
      }
  
      const menuItem = await Menu.findById(menuId);
  
      if (!menuItem || !menuItem.isAvailable) {
        res.status(404);
        throw new Error("Menu item not available");
      }
  
      const cartKey = `cart:${userId}`;
  
      await redisClient.hIncrBy(cartKey, menuId, Number(quantity));
      await redisClient.expire(cartKey, CART_TTL);
  
      res.json({
        success: true,
        message: "Item added to cart"
      });
  
    } catch (error) {
      next(error);
    }
  };
  

export const getCart = async (req,res,next) => {
    try {

        const userId = req.user._id.toString();
        const cartKey = `cart:${userId}`

        const cartItems = await redisClient.hGetAll(cartKey)

        const menuIds = Object.keys(cartItems);

        const menuDetails = await Menu.find({
            _id: {$in:menuIds}
        });

        const formattedCart = menuDetails.map((item) => ({
            menuId:item._id,
            name:item.name,
            price:item.price,
            quantity:Number(cartItems[item._id]),
            total:item.price * Number(cartItems[item._id])
        }))

        const grandTotal = formattedCart.reduce(
            (sum , item) => sum + item.total,
            0
        );

        res.json({
            success: true,
            items: formattedCart,
            grandTotal,
          });
        
    } catch (error) {
        next(error)
    }
}


export const removeCart = async (req,res,next) => {
    try {

        const userId = req.user._id.toString();
        const {menuId} = req.body;

        const cartKey = `cart:${userId}`

        await redisClient.hDel(cartKey , menuId)

        res.json({
            success:true,
            message:"Item removed"
        });
        
    } catch (error) {
        next(error)
    }
}


export const clearCart = async (req,res,next) => {
    try {

        const userId = req.user._id.toString();

        const cartKey = `cart:${userId}`

        await redisClient.del(cartKey);

        res.json({
            success:true,
            message: "Cart cleared"
        })
        
    } catch (error) {
        next(error)
    }
}






