const Computer = require("../models/computer.model");
const Room = require("../models/room.model");
const Application = require("../models/application.model");

const AgentController = {
    connect: async (req, res) => {
        try {
            const {
                room_id,
                row_index,
                column_index,
                ip_address,
                mac_address,
                hostname,
            } = req.body;

            const room = await Room.findById(room_id);

            if (!room) {
                res.status(400).json({ error: "Room not found" });
                return;
            }

            let computer = await Computer.findByRoomAndIndex(
                room_id,
                row_index,
                column_index
            );

            let computerId;
            if (!computer) {
                computerId = await Computer.create({
                    room_id,
                    row_index,
                    column_index,
                    ip_address,
                    mac_address,
                    hostname,
                });
            } else {
                computerId = await Computer.update({
                    id: computer.id,
                    room_id,
                    row_index,
                    column_index,
                    ip_address,
                    mac_address,
                    hostname,
                });
            }

            // Update applications list
            // if (req.body.applications) {
            //     // Update applications list
            //     availableApplications = await Application.all();
            //     installedApplications = await Computer.getApplications(
            //         computer.id
            //     );

            //     // Add new applications to database
            //     for (const application of req.body.applications) {
            //         // Check if application is available
            //         const availableApplication = availableApplications.find(
            //             (a) => a.name === application
            //         );
            //         if (availableApplication) {
            //             // Check if application is installed
            //             const installedApplication = installedApplications.find(
            //                 (a) => a.name === application
            //             );
            //             if (!installedApplication) {
            //                 // Install application
            //                 await Computer.installApplication(
            //                     computer.id,
            //                     availableApplication.id,
            //                     "agent"
            //                 );
            //             }
            //         }
            //     }

            //     // Remove uninstalled applications from database
            //     for (const application of installedApplications) {
            //         if (!req.body.applications.includes(application.name)) {
            //             await Computer.removeApplication(
            //                 computer.id,
            //                 application.id
            //             );
            //         }
            //     }
            // }

            res.send({ message: "Connected successfully", id: computerId });
        } catch (err) {
            console.error(err);
            // if room not found
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).json({ error: "Room not found" });
            }
            res.status(500).send("Internal Server Error");
        }
    },

    heartbeat: async (req, res) => {
        try {
            const { computer_id } = req.body;

            const computer = await Computer.findById(computer_id);

            if (!computer) {
                res.status(400).send("Computer not found");
                return;
            }

            await Computer.heartbeat(computer_id);

            res.send({ message: "Computer heartbeatd successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },
};

module.exports = AgentController;
