const Computer = require("../models/computer.model");
const Room = require("../models/room.model");
const Application = require("../models/application.model");
const File = require("../models/file.model");

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

            if (row_index < 0 || row_index > room.row_count) {
                return res.status(400).json({
                    error: `Row index must be between 0 and ${room.row_count}`,
                    code: "INVALID_ROW_INDEX"
                });
            }

            if (column_index < 0 || column_index > room.column_count) {
                return res.status(400).json({
                    error: `Column index must be between 0 and ${room.column_count}`,
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

    updateListFileAndApplication: async (req, res) => {
        const { id } = req.params;
        const { listFile, listApplication } = req.body;

        const computer = await Computer.findById(id);
        if (!computer) {
            res.status(404).send("Computer not found");
            return;
        }

        const availableApplications = await Application.all();
        const installedApplications = await Computer.getApplications(computer.id);

        for (const application of listApplication) {
            const availableApplication = availableApplications.find(
                (a) => a.name === application
            );
                    if (availableApplication) {
                        const installedApplication = installedApplications.find(
                            (a) => a.name === application
                        );
                        if (!installedApplication) {
                            await Computer.installApplication(
                                computer.id,
                                availableApplication.id,
                                1
                            );
                }
            }
        }

        for (const application of installedApplications) {
            if (!listApplication.includes(application.name)) {
                await Computer.removeApplication(
                    computer.id,
                    application.id
                );
            }
        }

        const availableFiles = await File.all();
        const installedFiles = await Computer.getFiles(computer.id);

        for (const file of listFile) {
            const availableFile = availableFiles.find((f) => f.name === file);
            if (availableFile) {
                const installedFile = installedFiles.find((f) => f.name === file);
                if (!installedFile) {
                    await Computer.installFile(computer.id, availableFile.id, 1);
                }
            }
        }

        for (const file of installedFiles) {
            if (!listFile.includes(file.name)) {
                await Computer.removeFile(computer.id, file.id);
            }
        }

        res.send("Updated successfully");
    },
};

module.exports = AgentController;

