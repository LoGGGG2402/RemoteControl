const jwt = require("jsonwebtoken");
const config = require("../config");

const JWT = {
    signAccessToken: (payload) => {
        return new Promise((resolve, reject) => {
            const secret = config.jwtSecret;
            if (!secret) {
                reject(new Error("No access token secret provided"));
            }
            const options = {
                expiresIn: config.accessTokenExpiration,
                issuer: "localhost",
            };
            jwt.sign({ data: payload }, secret, options, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    },

    signRefreshToken: (payload) => {
        return new Promise((resolve, reject) => {
            const secret = config.refreshTokenSecret;
            if (!secret) {
                reject(new Error("No refresh token secret provided"));
            }
            const options = {
                expiresIn: config.refreshTokenExpiration,
                issuer: "localhost",
            };
            jwt.sign({ data: payload }, secret, options, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    },

    verifyRefreshToken: (token) => {
        return new Promise((resolve, reject) => {
            const secret = config.refreshTokenSecret;
            if (!secret) {
                reject(new Error("No refresh token secret provided"));
            }
            jwt.verify(token, secret, (err, decoded) => {
                if (err) reject(err);
                resolve(decoded.data);
            });
        });
    },

    verifyAccessToken: (token) => {
        return new Promise((resolve, reject) => {
            const secret = config.jwtSecret;
            if (!secret) {
                reject(new Error("No access token secret provided"));
            }
            jwt.verify(token, secret, (err, decoded) => {
                if (err) {
                    reject(err);
                }
                resolve(decoded.data);
            });
        });
    },
};

module.exports = JWT;
