const Computer = require("../models/computer.model");
const Room = require("../models/room.model");
const Application = require("../models/application.model");

const AgentController = {
    connect: async (req, res) => {
        try {
            const {
                room_name,
                row_index,
                column_index,
                ip_address,
                mac_address,
                hostname,
            } = req.body;
            
            if (!room_name) {
                return res.status(400).json({ 
                    error: "Room name is required",
                    code: "ROOM_NAME_REQUIRED"
                });
            }

            const room = await Room.findByName(room_name);
            if (!room) {
                return res.status(400).json({ 
                    error: "Room not found",
                    code: "ROOM_NOT_FOUND" 
                });
            }

            if (row_index < 1 || row_index > room.row_count) {
                return res.status(400).json({
                    error: `Row index must be between 1 and ${room.row_count}`,
                    code: "INVALID_ROW_INDEX"
                });
            }

            if (column_index < 1 || column_index > room.column_count) {
                return res.status(400).json({
                    error: `Column index must be between 1 and ${room.column_count}`,
                    code: "INVALID_COLUMN_INDEX"
                });
            }

            // Kiểm tra vị trí đã có máy tính khác chưa
            const existingComputer = await Computer.findByRoomAndIndex(
                room.id,
                row_index,
                column_index
            );
            
            if (existingComputer && existingComputer.mac_address !== mac_address) {
                return res.status(400).json({
                    error: "This position is already occupied by another computer",
                    code: "POSITION_OCCUPIED"
                });
            }

            let computer = await Computer.findByRoomAndIndex(
                room.id,
                row_index,
                column_index
            );

            let computerId;
            if (!computer) {
                computerId = await Computer.create({
                    room_id: room.id,
                    row_index,
                    column_index,
                    ip_address,
                    mac_address,
                    hostname,
                });
            } else {
                computerId = await Computer.update({
                    id: computer.id,
                    room_id: room.id,
                    row_index,
                    column_index,
                    ip_address,
                    mac_address,
                    hostname,
                });
            }

            // Update applications list
            if (req.body.applications) {
                availableApplications = await Application.all();
                installedApplications = await Computer.getApplications(computerId);

                for (const application of req.body.applications) {
                    const availableApplication = availableApplications.find(
                        (a) => a.name === application
                    );
                    if (availableApplication) {
                        const installedApplication = installedApplications.find(
                            (a) => a.name === application
                        );
                        if (!installedApplication) {
                            await Computer.installApplication(
                                computerId,
                                availableApplication.id,
                                1
                            );
                        }
                    }
                }

                for (const application of installedApplications) {
                    if (!req.body.applications.includes(application.name)) {
                        await Computer.removeApplication(
                            computerId,
                            application.id
                        );
                    }
                }
            }

            res.send({ message: "Connected successfully", id: computerId });
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).json({ error: "Room not found" });
            }
            res.status(500).send("Internal Server Error");
        }
    },
};

module.exports = AgentController;
