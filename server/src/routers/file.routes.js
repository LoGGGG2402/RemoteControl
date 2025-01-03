const { Router } = require("express");
const FileController = require("../controllers/file.controllers");
const permissionMiddleware = require("../middlewares/permission.middleware");

const router = Router();

// File management routes
router.get("/", permissionMiddleware("view", "none"), FileController.all);
router.post("/", permissionMiddleware("manage", "global"), FileController.create);
router.put("/:id", permissionMiddleware("manage", "global"), FileController.update);
router.delete("/:id", permissionMiddleware("manage", "global"), FileController.delete);


module.exports = router; 