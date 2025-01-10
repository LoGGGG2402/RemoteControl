const Permissions = require("../models/permission.model");
const Computer = require("../models/computer.model");
const permissionMiddleware = (action, scope) => async (req, res, next) => {
    try {
        const user = req.user;

        if (scope === "none") {
            return next();
        }

        if (!user) {
            throw new Error();
        }

        // Admin has all permissions
        if (user.role === "admin") {
            return next();
        }

        if (scope === "global") {
            return res.status(403).send({
                message: "Permission denied",
                error: "Permission denied",
            });
        }

        if (scope === "room") {
            const roomId = req.params.id;
            const permission = await Permissions.findByUserAndRoom(
                user.id,
                roomId
            );
            if (!permission) {
                throw new Error();
            }

            if (action === "view" && permission.can_view === 1) {
                return next();
            }

            if (action === "manage" && permission.can_manage === 1) {
                return next();
            }
            return res.status(403).send({
                message: "Permission denied",
                error: "Permission denied",
            });
        }

        if (scope === "computer") {
            const computerId = req.params.id;
            const computer = await Computer.findById(computerId);
            if (!computer) {
                throw new Error();
            }

            const permission = await Permissions.findByUserAndRoom(
                user.id,
                computer.room_id
            );
            if (!permission) {
                throw new Error();
            }

            if (action === "view" && permission.can_view === 1) {
                return next();
            }

            if (action === "manage" && permission.can_manage === 1) {
                return next();
            }
            return res.status(403).send({
                message: "Permission denied",
                error: "Permission denied",
            });
        }

        next();
    } catch (err) {
        console.log(err);
        res.status(403).send({
            message: "Permission denied",
            error: "Permission denied",
        });
    }
};

module.exports = permissionMiddleware;
