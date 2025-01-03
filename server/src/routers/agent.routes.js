const { Router } = require("express");
const AgentController = require("../controllers/agent.controllers");

const router = Router();

router.post("/connect", AgentController.connect);
router.post("/update-list-file-and-application/:id", AgentController.updateListFileAndApplication);

module.exports = router;
