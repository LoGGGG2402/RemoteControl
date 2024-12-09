const { db } = require("../db");
const { findByRoomAndIndex } = require("./computer.model");

const Room = {
    create: (room) => {
        return new Promise((resolve, reject) => {
            const { name, description, row_count, column_count } = room;
            const sql = `INSERT INTO rooms (name, description, row_count, column_count) VALUES (?, ?, ?, ?)`;
            db.run(sql, [name, description, row_count, column_count], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM rooms WHERE id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    findByName: (name) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM rooms WHERE name = ?`;
            db.get(sql, [name], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, description FROM rooms`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    amount: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM rooms`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    update: (room) => {
        return new Promise((resolve, reject) => {
            const { id, name, description, row_count, column_count } = room;
            const sql = `UPDATE rooms SET name = ?, description = ?, row_count = ?, column_count = ? WHERE id = ?`;
            db.run(
                sql,
                [name, description, row_count, column_count, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },
    delete: (id) => {
        return new Promise((resolve, reject) => {
            // Start a transaction
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                // Delete permissions first
                db.run(
                    "DELETE FROM permissions WHERE room_id = ?",
                    [id],
                    (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return reject(err);
                        }

                        // Then delete computers
                        db.run(
                            "DELETE FROM computers WHERE room_id = ?",
                            [id],
                            (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return reject(err);
                                }

                                // Finally delete the room
                                db.run(
                                    "DELETE FROM rooms WHERE id = ?",
                                    [id],
                                    (err) => {
                                        if (err) {
                                            db.run("ROLLBACK");
                                            return reject(err);
                                        }

                                        db.run("COMMIT");
                                        resolve();
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    },
    // Permissions
    getUsers: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT u.id, u.full_name, u.email, u.role, p.can_view, p.can_manage
                     FROM users u
                     JOIN permissions p ON u.id = p.user_id
                     WHERE p.room_id = ?`;
            db.all(sql, [id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Computers
    getComputers: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT computers.id, computers.hostname, computers.ip_address, computers.row_index, computers.column_index,  (heartbeatd_at > datetime('now', '-1 minutes')) as online, (errors IS NOT NULL AND errors != '') as error
                    FROM computers join heartbeatd_computers on computers.id = heartbeatd_computers.computer_id
                    WHERE computers.room_id = ?`;
            db.all(sql, [id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    getComputersInstalled: (id, application_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT c.id, c.row_index, c.column_index, ia.installed_at
                     FROM computers c
                     JOIN installed_applications ia ON c.id = ia.computer_id
                     WHERE c.room_id = ? AND ia.application_id = ?`;
            db.all(sql, [id, application_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Computers amount
    amountComputers: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM computers WHERE room_id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    amountErrors: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM computers WHERE room_id = ? AND errors IS NOT NULL AND errors != ''`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    amountOnline: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount 
                        FROM computers join heartbeatd_computers on computers.id = heartbeatd_computers.computer_id
                        WHERE room_id = ? AND heartbeatd_at > datetime('now', '-1 minutes')`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
};

module.exports = Room;
