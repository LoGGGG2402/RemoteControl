const db = require("../db");

const Computer = {
    create: (computer) => {
        return new Promise((resolve, reject) => {
            const { name, description, price, brand, type } = computer;
            const sql = `INSERT INTO computers (name, description, price, brand, type) VALUES (?, ?, ?, ?, ?)`;
            db.run(sql, [name, description, price, brand, type], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM computers WHERE id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    findByMacAddress: (mac_address) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM computers WHERE mac_address = ?`;
            db.get(sql, [mac_address], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    findByRoomAndIndex: (room_id, row_index, column_index) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM computers WHERE room_id = ? AND row_index = ? AND column_index = ?`;
            db.get(sql, [room_id, row_index, column_index], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, description, price, brand, type FROM computers`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    amount: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM computers`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    amountErrors: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM computers WHERE errors IS NOT NULL`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    amountOnline: () => {
        return new Promise((resolve, reject) => {
            // offline = updated_at < now - 10 minutes
            const sql = `SELECT COUNT(*) AS amount FROM computers WHERE updated_at >= datetime('now', '-10 minutes')`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    update: (computer) => {
        return new Promise((resolve, reject) => {
            const {
                room_id,
                row_index,
                column_index,
                ip_address,
                mac_address,
                hostname,
                notes,
                errors,
            } = computer;
            const updated_at = new Date().toISOString();
            const sql = `UPDATE computers SET ip_address = ?, mac_address = ?, hostname = ?, notes = ?, errors = ?, updated_at = ? 
                        WHERE room_id = ? AND row_index = ? AND column_index = ?`;
            db.run(
                sql,
                [
                    ip_address,
                    mac_address,
                    hostname,
                    notes,
                    errors,
                    updated_at,
                    room_id,
                    row_index,
                    column_index,
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },
    delete: (id) => {
        return new Promise((resolve, reject) => {
            // delete computer by id and all its installed applications
            const sql = `DELETE FROM installed_applications WHERE computer_id = ?
                         DELETE FROM computers WHERE id = ?`;
            db.run(sql, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    // applications
    installApplication: (computer_id, application_id, installed_by) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO installed_applications (computer_id, application_id, installed_by) VALUES (?, ?, ?)`;
            db.run(sql, [computer_id, application_id, installed_by], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    removeApplication: (computer_id, application_id) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM installed_applications WHERE computer_id = ? AND application_id = ?`;
            db.run(sql, [computer_id, application_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    getApplications: (computer_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT a.id, a.name, a.description, ia.installed_at
                         FROM applications a
                         JOIN installed_applications ia ON a.id = ia.application_id
                         WHERE ia.computer_id = ?`;
            db.all(sql, [computer_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    isInstalledApplication: (computer_id, application_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount
                         FROM installed_applications
                         WHERE computer_id = ? AND application_id = ?`;
            db.get(sql, [computer_id, application_id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount > 0);
            });
        });
    },
};

module.exports = Computer;
