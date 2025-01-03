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

// File Routes
router.get(
    "/:id/files",
    permissionMiddleware("view", "computer"),
    ComputerController.viewFiles
);

router.post(
    "/:id/files",
    permissionMiddleware("manage", "computer"),
    ComputerController.installFile
);

router.delete(
    "/:id/files",
    permissionMiddleware("manage", "computer"),
    ComputerController.deleteFile
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
    "/:id/notes",
    permissionMiddleware("manage", "computer"),
    ComputerController.updateNotes
);

router.post(
    "/:id/errors",
    permissionMiddleware("manage", "computer"),
    ComputerController.addError
);

router.put(
    "/:id/errors/:error_id/resolve",
    permissionMiddleware("manage", "computer"),
    ComputerController.resolveError
);

router.get(
    "/:id/errors",
    permissionMiddleware("view", "computer"),
    ComputerController.getErrors
);

module.exports = router;
