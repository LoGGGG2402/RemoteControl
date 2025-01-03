const File = require("../models/file.model");
const { sendCommandToComputer } = require("../utils/agentCommunication");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const FileController = {
    create: async (req, res) => {
        try {
            // Kiểm tra xem có file được upload không
            if (!req.files || !req.files.file) {
                return res.status(400).send("No file uploaded");
            }

            const file = req.files.file;
            const { name, description } = req.body;
            
            if (!name) {
                return res.status(400).send("File name is required");
            }

            // Create uploads directory if it doesn't exist
            const uploadDir = path.join(__dirname, "../../uploads");
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Generate unique filename
            const filename = crypto.createHash('sha256')
                .update(Date.now() + "-" + file.name)
                .digest('hex') + path.extname(file.name);
            const filepath = path.join(uploadDir, filename);

            // Move file to uploads directory
            await file.mv(filepath);

            // Save file info to database
            const fileId = await File.create({
                name,
                file_path: filepath,
                description,
                created_by: req.user.id
            });

            res.status(201).json({ id: fileId });
        } catch (err) {
            console.error("File upload error:", err);
            res.status(500).send("Failed to upload file");
        }
    },

    all: async (req, res) => {
        try {
            const files = await File.all();
            res.json(files);
        } catch (err) {
            console.error(err);
            res.status(500).send("Failed to fetch files");
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const file = await File.findById(id);
            
            if (!file) {
                return res.status(404).send("File not found");
            }

            // Delete physical file
            if (fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path);
            }
            
            await File.delete(id);
            res.status(204).send();
        } catch (err) {
            console.error(err);
            res.status(500).send("Failed to delete file");
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const file = req.files?.file;

            // Kiểm tra file tồn tại
            const existingFile = await File.findById(id);
            if (!existingFile) {
                return res.status(404).send("File not found");
            }

            // Nếu có file mới được upload
            if (file) {
                // Xóa file cũ
                if (fs.existsSync(existingFile.file_path)) {
                    fs.unlinkSync(existingFile.file_path);
                }

                // Lưu file mới
                const filename = crypto.createHash('sha256')
                    .update(Date.now() + "-" + file.name)
                    .digest('hex') + path.extname(file.name);
                const filepath = path.join(__dirname, "../../uploads", filename);
                await file.mv(filepath);

                // Cập nhật đường dẫn file mới
                await File.update(id, {
                    name: name || existingFile.name,
                    description: description !== undefined ? description : existingFile.description,
                    file_path: filepath
                });
            } else {
                // Chỉ cập nhật thông tin
                await File.update(id, {
                    name: name || existingFile.name,
                    description: description !== undefined ? description : existingFile.description,
                    file_path: existingFile.file_path
                });
            }

            res.status(200).send("File updated successfully");
        } catch (err) {
            console.error("File update error:", err);
            res.status(500).send("Failed to update file");
        }
    }, 

};

module.exports = FileController; 