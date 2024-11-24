const {db} = require("../db");
const { findById } = require("./computer.model");

const Application = {
    create: (application) => {
        return new Promise((resolve, reject) => {
            const { name, description, create_by } = application;
            const sql = `INSERT INTO applications (name, description, create_by) VALUES (?, ?, ?)`;
        });
    },
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM applications WHERE id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, description FROM applications`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    amount: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM applications`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    delete: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM installed_applications WHERE application_id = ?;
                         DELETE FROM applications WHERE id = ?`;
            db.run(sql, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
};

module.exports = Application;
