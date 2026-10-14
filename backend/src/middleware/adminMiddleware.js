/**
 * @file adminMiddleware.js
 * @summary Express middleware that protects admin-only routes.
 *          Extracts the JWT from the request cookie, verifies it with the secret key, confirms the
 *          user's role is 'admin', checks the token is not in the Redis blocklist (logged-out tokens),
 *          and attaches the user document to req.result before calling next().
 *
 * @functions
 * - adminMiddleware: Validates the cookie JWT, checks Redis blocklist, enforces admin role,
 *                    and forwards the authenticated admin user on success.
 */

const jwt=require('jsonwebtoken');
const User=require("../models/user");
const redisClient=require("../config/redis")
const adminMiddleware=async(req,res,next)=>{
    try {
        const token=req.cookies.token;
        // console.log("Admin Middleware Token:", token);
        // console.log(req.body);
        if(!token){
            throw new Error('Unauthorized');
        }
        const payload=jwt.verify(token,process.env.JWT_KEY);
        // console.log("Admin Middleware Payload:", payload);
        const{_id}=payload;
        if(!_id){
            throw new Error('Invalid Token');
        }
        const result=await User.findById(_id);
        if(payload.role!='admin'){
            throw new Error('Invalid Token');
        }
        if(!result){
            throw new Error('User not found');
        }
        // Redis ke block list me present toh nhi hai token
        const IsBlocked=await redisClient.exists(`token:${token}`);
        if(IsBlocked){
            throw new Error('Invalid Token');
        }
        req.result=result;
        // console.log("Admin Middleware User:", req.result);
        next();
    } catch (error) {
        res.status(401).send("Error: adminMiddleware"+error);
    }
}

module.exports=adminMiddleware;