const { Router } = require("express");
const ApplicationController = require("../controllers/application.controllers");
const permissionMiddleware = require("../middlewares/permission.middleware");

const router = Router();

router.get("/", permissionMiddleware("view", "none"), ApplicationController.all);
router.post("/", permissionMiddleware("manage", "global"), ApplicationController.create);

router.put("/:id", permissionMiddleware("manage", "global"), ApplicationController.update);
router.delete("/:id", permissionMiddleware("manage", "global"), ApplicationController.delete);

module.exports = router;