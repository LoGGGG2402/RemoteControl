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
            
            let computerId;
            
            // If computer exists, update it, otherwise create a new one
            if (existingComputer) {
                try {
                    computerId = await Computer.update({
                        id: existingComputer.id,
                        room_id: room.id,
                        row_index,
                        column_index,
                        ip_address,
                        mac_address,
                        hostname,
                    });
                } catch (updateError) {
                    console.error("Error updating computer:", updateError);
                    return res.status(500).json({ 
                        error: "Failed to update computer record",
                        code: "DATABASE_ERROR"
                    });
                }
            } else {
                try {
                    computerId = await Computer.create({
                        room_id: room.id,
                        row_index,
                        column_index,
                        ip_address,
                        mac_address,
                        hostname,
                    });
                } catch (createError) {
                    console.error("Error creating computer:", createError);
                    return res.status(500).json({ 
                        error: "Failed to create computer record",
                        code: "DATABASE_ERROR"
                    });
                }
            }
            
            // Ensure we have a valid computer ID
            if (!computerId) {
                return res.status(500).json({ 
                    error: "Failed to create or update computer record",
                    code: "DATABASE_ERROR"
                });
            }
            
            // Return both message and ID as expected by the agent
            return res.json({ 
                message: "Connected successfully", 
                id: computerId 
            });
        } catch (err) {
            console.error("Agent connect error:", err);
            if (err.code === "SQLITE_CONSTRAINT") {
                return res.status(400).json({ 
                    error: "Room not found", 
                    code: "ROOM_NOT_FOUND" 
                });
            }
            return res.status(500).json({ 
                error: "Internal Server Error", 
                code: "INTERNAL_SERVER_ERROR" 
            });
        }
    },

    updateListFileAndApplication: async (req, res) => {
        try {
            const { id } = req.params;
            const { listFile, listApplication } = req.body;
            
            const computer = await Computer.findById(id);
            if (!computer) {
                return res.status(404).json({ 
                    error: "Computer not found", 
                    code: "COMPUTER_NOT_FOUND" 
                });
            }
            
            // Use the new method in Computer model to handle database operations
            await Computer.updateListFileAndApplication(id, listFile, listApplication);
            
            return res.json({ message: "Updated successfully" });
        } catch (err) {
            console.error("Error updating application and file lists:", err);
            return res.status(500).json({ 
                error: "Internal Server Error", 
                code: "INTERNAL_SERVER_ERROR" 
            });
        }
    },
};

module.exports = AgentController;

