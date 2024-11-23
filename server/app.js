const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");

const indexRouter = require("./src/routers/index");
const config = require("./src/config");
const { initDatabase } = require("./src/db");

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173", // Your frontend URL
        credentials: true,
    })
);

app.use(logger(config.logLevel));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api", indexRouter);

// Database
initDatabase();

module.exports = app;
