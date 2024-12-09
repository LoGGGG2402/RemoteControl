const Application = require("../models/application.model");

const ApplicationController = {
    create: async (req, res) => {
        try {
            const { name, description, version } = req.body;
            
            if (!name) {
                return res.status(400).send("Application name is required");
            }
            
            await Application.create({ name, description, version });
            res.status(201).send("Application created");
        } catch (err) {
            console.error(err);
            if (err.code === "SQLITE_CONSTRAINT") {
                return res.status(400).send("Application with this name already exists");
            }
            res.status(500).send("Failed to create application");
        }
    },

    all: async (req, res) => {
        try {
            const applications = await Application.all();
            res.json(applications);
        } catch (err) {
            console.error(err);
            res.status(500).send("Failed to fetch applications");
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const application = await Application.findById(id);
            
            if (!application) {
                return res.status(404).send("Application not found");
            }
            
            await Application.delete(id);
            res.status(204).send();
        } catch (err) {
            console.error(err);
            res.status(500).send("Failed to delete application");
        }
    },

    update: async (req, res) => {
        console.log("Update application");
        try {
            const { id } = req.params;
            const { description, version } = req.body;
            
            const application = await Application.findById(id);
            if (!application) {
                return res.status(404).send("Application not found");
            }
            
            await Application.update(id, { description, version });
            res.status(200).send("Application updated");
        } catch (err) {
            console.error(err);
            res.status(500).send("Failed to update application");
        }
    },
};

module.exports = ApplicationController;