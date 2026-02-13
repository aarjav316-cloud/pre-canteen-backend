import Menu from "../models/Menu.js";
import { redisClient } from "../config/redis.js";

export const addMenuItems = async (req,res,next) => {
    try {

        const {price , category , name , description} = req.body;

        if(!price || !category || !name || !description){
            return res.json({

                success:false,
                message:"insufficient details"                  

            })
        }

        const menu = await Menu.create({
            name,
            description,
            price,
            category
        })

        await redisClient.del("menu:all");

        res.status(201).json({
            success:true,
            message:"Menu item added",
            menu,
        })
        
    } catch (error) {
        next(error)
    }
}


export const getAllMenu = async (req,res,next)  => {
    try {

        const cachedMenu = await redisClient.get("menua:all");

        if(cachedMenu){
            return res.json({
                success:true,
                source:"cache",
                data: JSON.parse(cachedMenu)
            })
        }

        const menu = await Menu.find({isAvailable:true});

        await redisClient.set( "menu:all" , JSON.stringify(menu), {
            EX:60,
        })

        res.json({
            success:true,
            source:"database",
            data: menu,
        })
        
    } catch (error) {
        next(error)
    }
}


export const searchMenu = async (req,res,next) => {
    try {

        const {keyword , category , page = 1 , limit = 5} = req.query;

        const query = {}

        if(keyword){
            query.$text = {$search: keyword}
        }

        if(category){
            query.category = category;
        }

        query.isAvailable = true;

        const skip = (page - 1) * limit;

        const menu = await Menu.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({createdAt: -1});

        const total = await Menu.countDocuments(query)


        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: menu
          });
          

        
    } catch (error) {
        next(error)
    }
}


