const Room = require("../models/room.model");
const Computer = require("../models/computer.model");
const Permissions = require("../models/permission.model");
const User = require("../models/user.model");
const Application = require("../models/application.model");
const File = require("../models/file.model");
const { sendCommandToComputer } = require("../utils/agentCommunication");

const RoomController = {
    create: async (req, res) => {
        try {
            const { name, description, row_count, column_count } = req.body;
            await Room.create({ name, description, row_count, column_count });
            res.status(201).send("Room created");
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                return res.status(400).send("Room already exists");
            }
            if (err.name === "ValidationError") {
                return res.status(400).send(err.message);
            }
            res.status(500).send("Internal Server Error");
        }
    },

    all: async (req, res) => {
        try {
            if (req.user.role === "admin") {
                const rooms = await Room.all();
                return res.json(rooms);
            }
            const rooms = await User.getRooms(req.user.id);
            return res.json(rooms);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    amount: async (req, res) => {
        try {
            if (req.user.role === "admin") {
                const amount = await Room.amount();
                res.json(amount);
            } else if (req.user.role === "manager") {
                const amount = await User.amountRooms(req.user.id);
                res.json(amount);
            } else {
                res.status(403).send("Forbidden");
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    delete: async (req, res) => {
        try {
            const id = req.params.id;
            await Room.delete(id);
            res.status(204).send();
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).send("Room is in use");
            }
            res.status(500).send("Internal Server Error");
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, row_count, column_count } = req.body;
            await Room.update({
                id,
                name,
                description,
                row_count,
                column_count,
            });
            res.status(200).send("Room updated");
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    get: async (req, res) => {
        try {
            const { id } = req.params;
            const room = await Room.findById(id);
            const computers = await Room.getComputers(id);
            if (!room) {
                res.status(404).send("Room not found");
                return;
            }
            room.computers = computers;
            res.json(room);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    // Computers
    amountComputers: async (req, res) => {
        try {
            const { id } = req.params;
            const amount = await Room.amountComputers(id);
            const amount_error = await Room.amountErrors(id);
            const amount_online = await Room.amountOnline(id);
            res.json({ amount, amount_error, amount_online });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    // Application management
    getComputersInstalled: async (req, res) => {
        try {
            const { id: room_id, application_id } = req.params;
            const computers = await Room.getComputersInstalled(
                room_id,
                application_id
            );
            res.json(computers);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    installApplication: async (req, res) => {
        try {
            const { id: room_id, application_id } = req.params;
            const user_id = req.user.id;
            const computers = await Room.getComputers(room_id);
            const application = await Application.findById(application_id);

            if (!computers || !application) {
                res.status(400).send("Room or application not found");
                return;
            }

            const installPromises = computers.map(async (computer) => {
                if (await Computer.isInstalledApplication(computer.id, application_id)) {
                    return null;
                }

                if (!computer.online) {
                    return {
                        computer_id: computer.id,
                        success: false,
                        message: "Computer is offline",
                        row_index: computer.row_index,
                        column_index: computer.column_index,
                    };
                }

                const response = await sendCommandToComputer(
                    computer.id,
                    "install_application",
                    {
                        name: application.name,
                        version: application.version,
                    }
                );

                if (!response) {
                    return {
                        computer_id: computer.id,
                        success: false,
                        message: "Can't connect to computer.",
                        row_index: computer.row_index,
                        column_index: computer.column_index,
                    };
                } else if (!response.success) {
                    return {
                        computer_id: computer.id,
                        success: false,
                        message: response.message,
                        row_index: computer.row_index,
                        column_index: computer.column_index,
                    };
                }

                await Computer.installApplication(computer.id, application_id, user_id);
                return {
                    computer_id: computer.id,
                    success: true,
                    message: "Application installed successfully",
                    row_index: computer.row_index,
                    column_index: computer.column_index,
                };
            });

            const results = (await Promise.all(installPromises)).filter(
                (result) => result !== null
            );
            res.json(results);
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).send("Room or application not found");
            }
            if (err.message.includes("Command timeout")) {
                res.status(400).send("Command timeout");
            }
            res.status(500).send("Internal Server Error");
        }
    },

    // File management
    getComputersInstalledFile: async (req, res) => {
        try {
            const { id: room_id, file_id } = req.params;
            const computers = await Room.getComputersInstalledFile(room_id, file_id);
            res.json(computers);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    installFile: async (req, res) => {
        try {
            const { id: room_id, file_id } = req.params;
            const user_id = req.user.id;
            const computers = await Room.getComputers(room_id);
            const file = await File.findById(file_id);

            if (!computers || !file) {
                res.status(400).send("Room or file not found");
                return;
            }

            const lastPath = file.file_path.split("/").pop();

            const installPromises = computers.map(async (computer) => {
                if (await Computer.isInstalledFile(computer.id, file_id)) {
                    return null;
                }

                if (!computer.online) {
                    return {
                        computer_id: computer.id,
                        success: false,
                        message: "Computer is offline",
                        row_index: computer.row_index,
                        column_index: computer.column_index,
                    };
                }

                const response = await sendCommandToComputer(
                    computer.id,
                    "install_file",
                    {
                        name: file.name,
                        link: `/uploads/${lastPath}`,
                    }
                );

                const { success, message } = response;

                if (!success) {
                    return {
                        computer_id: computer.id,
                        success: false,
                        message: message,
                        row_index: computer.row_index,
                        column_index: computer.column_index,
                    };
                }

                await Computer.installFile(computer.id, file_id, user_id);
                return {
                    computer_id: computer.id,
                    success: true,
                    message: "File installed successfully",
                    row_index: computer.row_index,
                    column_index: computer.column_index,
                };
            });

            const results = (await Promise.all(installPromises)).filter(
                (result) => result !== null
            );
            res.json(results);
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).send("Room or file not found");
            }
            if (err.message.includes("Command timeout")) {
                res.status(400).send("Command timeout");
            }
            res.status(500).send("Internal Server Error");
        }
    },

    // User permissions
    addUser: async (req, res) => {
        try {
            const { room_id, user_id, can_view, can_manage } = req.body;
            await Permissions.create({
                room_id,
                user_id,
                can_view,
                can_manage,
            });
            res.status(201).send("User added to room");
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).send("User already added to room");
            }
            res.status(500).send("Internal Server Error");
        }
    },

    removeUser: async (req, res) => {
        try {
            const { user_id } = req.body;
            const { id: room_id } = req.params;
            await Permissions.delete(user_id, room_id);
            res.status(204).send();
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    getUsers: async (req, res) => {
        try {
            const { id } = req.params;
            const users = await Room.getUsers(id);
            res.json(users);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },
};

module.exports = RoomController;
