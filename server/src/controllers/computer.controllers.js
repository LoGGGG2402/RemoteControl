const Computer = require("../models/computer.model");
const Application = require("../models/application.model");

const { sendCommandToComputer } = require("../utils/agentCommunication");

const ComputerController = {
    all: async (req, res) => {
        try {
            const computers = await Computer.all();
            res.json(computers);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    get: async (req, res) => {
        try {
            const id = req.params.id;
            const computer = await Computer.findById(id);

            if (!computer) {
                res.status(404).send("Computer not found");
                return;
            }

            res.json(computer);
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    amount: async (req, res) => {
        try {
            const amount = await Computer.amount();
            const amount_error = await Computer.amountErrors();
            const amount_online = await Computer.amountOnline();
            res.json({ amount, amount_error, amount_online });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    delete: async (req, res) => {
        try {
            const id = req.params.id;
            await Computer.delete(id);
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting computer:", err);
            if (err.code === "SQLITE_CONSTRAINT") {
                res.status(400).send("Computer is in use");
            }
            res.status(500).send("Internal Server Error");
        }
    },

    viewProcesses: async (req, res) => {
        try {
            const { id } = req.params;
            const computer = await Computer.findById(id);

            if (!computer) {
                res.status(404).send("Computer not found");
                return;
            }

            const isOnline = await Computer.isOnline(id);
            if (!isOnline) {
                return res.status(503).json({
                    error: "Computer is offline. Please try again when it's online.",
                });
            }

            const processList = await sendCommandToComputer(
                computer.ip_address,
                "get_process_list"
            );

            if (!processList) {
                return res.status(503).json({
                    error: "Unable to retrieve process list from the computer",
                });
            }

            res.status(200).json({ processList });
        } catch (err) {
            console.error("Error viewing processes:", err);
            res.status(500).send("Internal Server Error");
        }
    },

    viewNetActivities: async (req, res) => {
        try {
            const { id } = req.params;
            const computer = await Computer.findById(id);

            if (!computer) {
                res.status(404).send("Computer not found");
                return;
            }

            const isOnline = await Computer.isOnline(id);
            if (!isOnline) {
                return res.status(503).json({
                    error: "Computer is offline. Please try again when it's online.",
                });
            }

            const networkConnections = await sendCommandToComputer(
                computer.ip_address,
                "get_network_connections"
            );

            if (!networkConnections) {
                return res.status(503).json({
                    error: "Unable to retrieve network connections from the computer",
                });
            }

            res.status(200).json({ networkConnections });
        } catch (error) {
            console.error("Error viewing computer network:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    viewApplications: async (req, res) => {
        try {
            const { id } = req.params;
            const computer = await Computer.findById(id);

            if (!computer) {
                res.status(404).send("Computer not found");
                return;
            }

            const applications = await Computer.getApplications(id);
            res.json(applications);
        } catch (error) {
            console.error("Error viewing computer applications:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    // Install application on computer
    installApplication: async (req, res) => {
        try {
            const { id } = req.params;
            const { application_id } = req.body;
            const computer = await Computer.findById(id);

            if (!computer) {
                res.status(404).send("Computer not found");
                return;
            }

            const isOnline = await Computer.isOnline(id);
            if (!isOnline) {
                return res.status(503).json({
                    error: "Computer is offline. Installation requires the computer to be online.",
                });
            }

            is_installed = await Computer.isInstalledApplication(
                id,
                application_id
            );
            if (is_installed) {
                return res
                    .status(400)
                    .json({ error: "Application already installed" });
            }

            const application = await Application.findById(application_id);

            if (!computer || !application) {
                res.status(400).send("Computer or application not found");
                return;
            }

            const response = await sendCommandToComputer(
                computer.ip_address,
                "install_application",
                {
                    name: application.name,
                    version: application.version,
                }
            );

            if (!response) {
                return res.status(503).json({
                    error: "Unable to install application on the computer",
                });
            }

            const { success, message } = response;

            if (!success) {
                return res.status(400).json({ error: message });
            }

            await Computer.installApplication(id, application_id, req.user.id);
            res.status(204).send(response.message);
        } catch (error) {
            console.error("Error installing application:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    uninstallApplication: async (req, res) => {
        try {
            const { id } = req.params;
            const { application_id } = req.body;
            const computer = await Computer.findById(id);

            if (!computer) {
                res.status(404).send("Computer not found");
                return;
            }

            const isOnline = await Computer.isOnline(id);
            if (!isOnline) {
                return res.status(503).json({
                    error: "Computer is offline. Uninstallation requires the computer to be online.",
                });
            }

            const application = await Application.findById(application_id);

            if (!computer || !application) {
                res.status(400).send("Computer or application not found");
                return;
            }

            const response = await sendCommandToComputer(
                computer.ip_address,
                "uninstall_application",
                {
                    name: application.name,
                }
            );

            if (!response) {
                return res.status(503).json({
                    error: "Unable to uninstall application from the computer",
                });
            }

            const { success, message } = response;

            if (!success) {
                return res.status(400).json({ error: message });
            }

            await Computer.removeApplication(id, application_id);
            res.status(204).send();
        } catch (error) {
            console.error("Error uninstalling application:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    // agent communication
    update: async (req, res) => {
        try {
            const { room_id, row_index, column_index } = req.params;
            const { ip_address, mac_address, hostname, notes, errors } =
                req.body;

            await Computer.update({
                room_id,
                row_index,
                column_index,
                ip_address,
                mac_address,
                hostname,
                notes,
                errors,
            });
            res.status(200).send("Computer updated");
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    updateNotesAndErrors: async (req, res) => {
        try {
            const { id } = req.params;
            const { notes, errors } = req.body;

            await Computer.updateNotesAndErrors(id, notes, errors);
            res.status(200).send("Notes and errors updated successfully");
        } catch (err) {
            console.error("Error updating notes and errors:", err);
            res.status(500).send("Internal Server Error");
        }
    },
};

module.exports = ComputerController;
