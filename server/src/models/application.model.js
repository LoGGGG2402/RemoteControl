const {db} = require("../db");
const { findById } = require("./computer.model");

const Application = {
    create: (application) => {
        return new Promise((resolve, reject) => {
            const { name, description } = application;
            const sql = `INSERT INTO applications (name, description) VALUES (?, ?)`;
            db.run(sql, [name, description], (err) => {
                if (err) reject(err);
                else resolve();
            });
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
            // delete application by id and all its installed applications
            db.run("BEGIN TRANSACTION");
            db.run("DELETE FROM installed_applications WHERE application_id = ?",
                [id],
                (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                    }

                    db.run("DELETE FROM applications WHERE id = ?", [id], (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return reject(err);
                        }

                        db.run("COMMIT", (err) => {
                            if (err) reject(err);
                            else resolve();
                        });

                    });
            });
        });
    },
};

module.exports = Application;
