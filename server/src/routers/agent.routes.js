const { Router } = require("express");
const AgentController = require("../controllers/agent.controllers");

const router = Router();

router.post("/connect", AgentController.connect);

module.exports = router;
