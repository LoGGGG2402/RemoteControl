const UserRoutes = require("./user.routes");
const AgentRoutes = require("./agent.routes");
const ComputerRoutes = require("./computer.routes");
const RoomRoutes = require("./room.routes");

const authMiddleware = require("../middlewares/auth.middleware");

const { Router } = require("express");

const router = Router();

router.use("/user", UserRoutes);
router.use("/agent", AgentRoutes);
router.use("/computer", authMiddleware, ComputerRoutes);
router.use("/room", authMiddleware, RoomRoutes);

module.exports = router;
