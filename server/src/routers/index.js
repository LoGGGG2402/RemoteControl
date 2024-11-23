const UserRoutes = require("./user.routes");
const AgentRoutes = require("./agent.routes");
const ComputerRoutes = require("./computer.routes");
const RoomRoutes = require("./room.routes");

const authMiddleware = require("../middlewares/auth.middleware");

const { Router } = require("express");

const router = Router();

router.use("/users", UserRoutes);
router.use("/agents", AgentRoutes);
router.use("/computers", authMiddleware, ComputerRoutes);
router.use("/rooms", authMiddleware, RoomRoutes);

module.exports = router;
