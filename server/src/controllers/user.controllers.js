const bcrypt = require("bcrypt");

const User = require("../models/user.model");
const jwt = require("../utils/jwt");

const UserController = {
    create: async (req, res) => {
        try {
            const { fullname, email, username, password, role } = req.body;
            let hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                fullname,
                email,
                username,
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

    // auth
    login: async (req, res) => {
        try {
            const { username, password, email } = req.body;
            if (!username && !email) {
                res.status(400).send("Username or email is required");
                return;
            }

            const user = username
                ? await User.findByUsername(username)
                : await User.findByEmail(email);
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
            const token = jwt.signAccessToken(user);
            const refreshToken = jwt.signRefreshToken(user);
            res.json({ user, token, refreshToken });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    refresh: async (req, res) => {
        try {
            const refreshToken = req.body.refreshToken;
            const user = jwt.verifyRefreshToken(refreshToken);
            const token = jwt.signAccessToken(user);
            res.json({ token });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },
};

module.exports = UserController;
