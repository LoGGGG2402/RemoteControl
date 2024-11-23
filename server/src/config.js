const config = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    logLevel: process.env.LOG_LEVEL || "dev",
    databasePath: process.env.DATABASE_PATH || "./db.sqlite",
    jwtSecret: process.env.JWT_SECRET || "secret",
    jwtExpiration: process.env.JWT_EXPIRATION || "1h",
    jwtAlgorithm: process.env.JWT_ALGORITHM || "HS256",
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "refresh-secret",
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || "7d",
    accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION || "15m",
};

module.exports = config;
