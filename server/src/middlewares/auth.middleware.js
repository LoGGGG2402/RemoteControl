const JWT = require("../utils/jwt");
const User = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header("Authorization").replace("Bearer ", "");
        if (!token) {
            console.error("No token provided");
            throw new Error();
        }

        const payload = await JWT.verifyAccessToken(token);
        const user = await User.findById(payload.id);
        if (!user) {
            throw new Error();
        }
        req.user = user;
        next();
    } catch (err) {
        console.error("Authentication failed:", err);
        res.status(401).send("Please authenticate");
    }
};

module.exports = authMiddleware;
