const bcrypt = require("bcrypt");

const User = require("../models/user.model");
const jwt = require("../utils/jwt");

const UserController = {
    create: async (req, res) => {
        try {
            const { full_name, email, password, role } = req.body;
            let hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                full_name,
                email,
                password: hashedPassword,
                role,
            });
            res.status(201).send("User created");
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).send("User already exists");
            }
            if (err.name === "ValidationError") {
                res.status(400).send(err.message);
            }
            res.status(500).send("Internal Server Error");
        }
    },

    all: async (req, res) => {
        try {
            const users = await User.all();
            res.json(users);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    amount: async (req, res) => {
        try {
            const amount = await User.amount();
            res.json(amount);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    get: async (req, res) => {
        try {
            const id = req.params.id;
            const user = await User.findById(id);
            if (!user) {
                res.status(404).send("User not found");
                return;
            }
            user.delete("password");
            res.json(user);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    // auth
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email) {
                res.status(400).send("Email is required");
                return;
            }

            const user = await User.findByEmail(email);
            if (!user) {
                res.status(404).send("User not found");
                return;
            }

            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                res.status(401).send("Invalid password");
                return;
            }
            // remove password from user object
            delete user.password;
            delete user.created_at;
            const token = await jwt.signAccessToken(user);
            const refreshToken = await jwt.signRefreshToken(user);

            // Add expiry times
            // const expireTime = new Date().getTime() + 15 * 60 * 1000; // 15 minutes
            const expireTime = new Date().getTime() + 60 * 1000; // 30 seconds
            const refreshTokenExpireTime =
                new Date().getTime() + 7 * 24 * 60 * 60 * 1000; // 7 days

            res.json({
                user,
                token,
                refreshToken,
                expireTime,
                refreshTokenExpireTime,
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    refresh: async (req, res) => {
        try {
            const refreshToken = req.body.refreshToken;
            if (!refreshToken) {
                return res.status(401).send("Refresh token required");
            }

            const user = await jwt.verifyRefreshToken(refreshToken);
            const newRefreshToken = await jwt.signRefreshToken(user);
            const newToken = await jwt.signAccessToken(user);

            const newExpireTime = new Date().getTime() + 1 * 60 * 1000;
            const newRefreshTokenExpireTime =
                new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
            res.json({
                newToken,
                newRefreshToken,
                newExpireTime,
                newRefreshTokenExpireTime,
            });
        } catch (err) {
            console.error(err);
            res.status(401).send("Invalid refresh token");
        }
    },
};

module.exports = UserController;
