// Core dependencies
const express = require("express");
const http = require('http');
const path = require("path");

// Middleware dependencies
const cors = require("cors");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const fileUpload = require('express-fileupload');

// Application modules
const indexRouter = require("./src/routers/index");
const config = require("./src/configs/config");
const { initDatabase } = require("./src/configs/db");
const { initializeWebSocket } = require("./src/utils/agentCommunication");
const websocketMiddleware = require('./src/middlewares/websocket.middleware');

// Initialize express application
const app = express();

// CORS configuration
app.use(cors({
    origin: "*",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Sec-WebSocket-Protocol']
}));

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(logger(config.logLevel));

// File handling middleware
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 1000 * 1024 * 1024 // 1GB max file size
    },
}));

// Static file serving
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
        res.set('Content-Disposition', 'attachment');
    }
}));

// API routes
app.use("/api", indexRouter);

// Database initialization
initDatabase();

// WebSocket handling
app.use('/ws', (req, res, next) => {
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        return next();
    }
    res.status(400).send('Expected WebSocket connection');
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket with the HTTP server
const wss = initializeWebSocket(server);
websocketMiddleware(wss);

module.exports = { expressApp: app, httpServer: server };
