const { Router } = require("express");

const UserController = require("../controllers/user.controllers");
const permissionMiddleware = require("../middlewares/permission.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const router = Router();

// View Routes
router.get(
    "/",
    authMiddleware,
    permissionMiddleware("view", "global"),
    UserController.all
);
router.get(
    "/amount",
    authMiddleware,
    permissionMiddleware("view", "global"),
    UserController.amount
);
// Management Routes
router.post(
    "/",
    permissionMiddleware("manage", "global"),
    UserController.create
);

// Authentication Routes
router.post("/auth/login", UserController.login);
router.post("/auth/refresh", UserController.refresh);

module.exports = router;
