const Computer = require("../models/computer.model");

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

            const command = "get_process_list";
            const processList = await sendCommandToComputer(
                computer.ip_address,
                command
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

            const command = "get_network_connections";
            const networkConnections = await sendCommandToComputer(
                computer.ip_address,
                command
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

            if (Computer.isInstalledApplication(id, application_id)) {
                return res
                    .status(400)
                    .json({ error: "Application already installed" });
            }

            const application = await Application.findById(application_id);

            if (!computer || !application) {
                res.status(400).send("Computer or application not found");
                return;
            }

            const command = "install_application " + application.name;

            const response = await sendCommandToComputer(
                computer.ip_address,
                command
            );

            if (!response) {
                return res.status(503).json({
                    error: "Unable to install application on the computer",
                });
            }

            if (response.error) {
                return res.status(400).json({ error: response.error });
            }

            await Computer.installApplication(id, application_id, req.user.id);
            res.status(204).send(response.message);
        } catch (error) {
            console.error("Error installing application:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },
};

module.exports = ComputerController;
