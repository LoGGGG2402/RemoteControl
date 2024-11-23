const JWT = require("../utils/jwt");
const User = require("../models/user.model");

const authMiddleware = () => {
    return async (req, res, next) => {
        try {
            const token = req.header("Authorization").replace("Bearer ", "");
            if (!token) {
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
            res.status(401).send("Please authenticate");
        }
    };
};

module.exports = authMiddleware;
