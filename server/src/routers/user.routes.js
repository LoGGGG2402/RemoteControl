const { Router } = require("express");

const UserController = require("../controllers/user.controllers");
const permissionMiddleware = require("../middlewares/permission.middleware");

const router = Router();

// View Routes
router.get(
    "/",
    permissionMiddleware("view", "global"),
    UserController.all
);
router.get(
    "/amount",
    permissionMiddleware("view", "global"),
    UserController.amount
);
// Management Routes
router.post(
    "/",
    permissionMiddleware("manage", "global"),
    UserController.create
);


module.exports = router;
