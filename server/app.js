const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const http = require('http');
const fileUpload = require('express-fileupload');

const indexRouter = require("./src/routers/index");
const config = require("./src/configs/config");
const { initDatabase } = require("./src/configs/db");
const { initializeWebSocket } = require("./src/utils/agentCommunication");
const websocketMiddleware = require('./src/middlewares/websocket.middleware');

const app = express();

app.use(
    cors({
        origin: "*",
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Sec-WebSocket-Protocol']
    })
);

app.use(logger(config.logLevel));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
        res.set('Content-Disposition', 'attachment');
    }
}));
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 1000 * 1024 * 1024 // 1Gb max file size
    },
}));

// Routes
app.use("/api", indexRouter);

// Database
initDatabase();

// Thêm middleware này trước khi khởi tạo WebSocket
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
