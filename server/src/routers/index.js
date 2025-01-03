const UserRoutes = require("./user.routes");
const AgentRoutes = require("./agent.routes");
const ComputerRoutes = require("./computer.routes");
const RoomRoutes = require("./room.routes");
const authRoutes = require("./auth.routes");
const ApplicationRoutes = require("./application.routes");
const FileRoutes = require("./file.routes");
const authMiddleware = require("../middlewares/auth.middleware");

const { Router } = require("express");

const router = Router();

router.use("/user", authMiddleware, UserRoutes);
router.use("/computer", authMiddleware, ComputerRoutes);
router.use("/room", authMiddleware, RoomRoutes);
router.use("/application", authMiddleware, ApplicationRoutes);

router.use("/agent", AgentRoutes);
router.use("/auth", authRoutes);
router.use("/file", authMiddleware, FileRoutes);
module.exports = router;
