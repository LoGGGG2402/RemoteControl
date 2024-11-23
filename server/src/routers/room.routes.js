const { Router } = require("express");
const RoomController = require("../controllers/room.controllers");
const permissionMiddleware = require("../middlewares/permission.middleware");

const router = Router();

// Monitor Routes
router.get("/", permissionMiddleware("view", "none"), RoomController.all);
router.get(
    "/amount",
    permissionMiddleware("view", "none"),
    RoomController.amount
);

// Management Routes
router.post(
    "/",
    permissionMiddleware("manage", "global"),
    RoomController.create
);
router.put(
    "/:id",
    permissionMiddleware("manage", "global"),
    RoomController.update
);
router.delete(
    "/:id",
    permissionMiddleware("manage", "global"),
    RoomController.delete
);

// Computer Routes
router.get(
    "/:id/computers",
    permissionMiddleware("view", "room"),
    RoomController.getComputers
);
router.get(
    "/:id/amount_computers",
    permissionMiddleware("view", "room"),
    RoomController.amountComputers
);

router.get(
    "/applications",
    permissionMiddleware("view", "room"),
    RoomController.getComputersInstalled
);
router.post(
    "/applications",
    permissionMiddleware("manage", "room"),
    RoomController.installApplication
);

// User Routes
router.get(
    "/:id/users",
    permissionMiddleware("view", "global"),
    RoomController.getUsers
);
router.post(
    "/users",
    permissionMiddleware("manage", "global"),
    RoomController.addUser
);
router.delete(
    "/users",
    permissionMiddleware("manage", "global"),
    RoomController.removeUser
);

module.exports = router;
