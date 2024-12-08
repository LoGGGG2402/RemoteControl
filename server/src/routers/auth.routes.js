const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controllers");

router.post("/login", userController.login);
router.post("/refresh", userController.refresh);

module.exports = router;
