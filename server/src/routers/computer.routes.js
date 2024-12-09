const { Router } = require("express");
const ComputerController = require("../controllers/computer.controllers");
const permissionMiddleware = require("../middlewares/permission.middleware");

const router = Router();

// Monitor Routes
router.get("/", permissionMiddleware("view", "global"), ComputerController.all);
router.get(
    "/amount",
    permissionMiddleware("view", "global"),
    ComputerController.amount
);

router.get(
    "/:id",
    permissionMiddleware("view", "computer"),
    ComputerController.get
);

router.get(
    "/:id/processes",
    permissionMiddleware("view", "computer"),
    ComputerController.viewProcesses
);

router.get(
    "/:id/network",
    permissionMiddleware("view", "computer"),
    ComputerController.viewNetActivities
);

router.get(
    "/:id/applications",
    permissionMiddleware("view", "computer"),
    ComputerController.viewApplications
);

// Management Routes
router.post(
    "/:id/applications",
    permissionMiddleware("manage", "computer"),
    ComputerController.installApplication
);

router.delete(
    "/:id/applications",
    permissionMiddleware("manage", "computer"),
    ComputerController.uninstallApplication
);

router.put(
    "/:id/notes-errors",
    permissionMiddleware("manage", "computer"),
    ComputerController.updateNotesAndErrors
);

module.exports = router;
