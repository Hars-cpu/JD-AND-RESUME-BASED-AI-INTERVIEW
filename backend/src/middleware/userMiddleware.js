/**
 * @file userMiddleware.js
 * @summary Express middleware that protects authenticated user routes.
 *          Reads the JWT cookie, verifies the signature, looks up the user by ID,
 *          checks the token is not in the Redis blocklist (for logout invalidation),
 *          and attaches the user document to req.user before passing control to next().
 *
 * @functions
 * - userMiddleware: Validates the cookie JWT, checks Redis blocklist, and forwards
 *                   the authenticated user document on success.
 */

const jwt = require('jsonwebtoken');
const User = require("../models/user");
const redisClient = require("../config/redis")
const userMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            throw new Error('Unauthorized');
        }
        const payload = jwt.verify(token, process.env.JWT_KEY);
        const { _id } = payload;
        if (!_id) {
            throw new Error('Invalid Token');
        }
        const result = await User.findById(_id);
        if (!result) {
            throw new Error('User not found');
        }
        // Redis ke block list me present toh nhi hai token
        const IsBlocked = await redisClient.exists(`token:${token}`);
        if (IsBlocked) {
            throw new Error('Invalid Token');
        }
        req.user = result;
        next();
    } catch (error) {
        res.status(401).send("Error: " + error);
    }
}

module.exports = userMiddleware;