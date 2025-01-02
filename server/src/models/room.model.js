const { db } = require("../db");
const { findByRoomAndIndex } = require("./computer.model");
const { computerClients } = require('../utils/agentCommunication');

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

                // Delete installed applications first
                db.run(
                    "DELETE FROM installed_applications WHERE computer_id IN (SELECT id FROM computers WHERE room_id = ?)",
                    [id],
                    (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return reject(err);
                        }

                        // Delete computer errors
                        db.run(
                            "DELETE FROM computer_error WHERE computer_id IN (SELECT id FROM computers WHERE room_id = ?)",
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

                                        // Then delete permissions
                                        db.run(
                                            "DELETE FROM permissions WHERE room_id = ?",
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
            const sql = `
                SELECT computers.*, 
                       COUNT(CASE WHEN computer_errors.resolved_at IS NULL THEN 1 END) as error_count
                FROM computers
                LEFT JOIN computer_errors ON computers.id = computer_errors.computer_id
                WHERE computers.room_id = ?
                GROUP BY computers.id`;
            db.all(sql, [id], (err, rows) => {
                if (err) reject(err);
                else {
                    rows = rows.map(row => ({
                        ...row,
                        online: computerClients.has(row.id.toString())
                    }));
                    resolve(rows);
                }
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
            const sql = `SELECT COUNT(*) AS amount
                        FROM computer_errors
                        WHERE computer_id IN (SELECT id FROM computers WHERE room_id = ?)
                        AND resolved_at IS NULL`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    amountOnline: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id FROM computers WHERE room_id = ?`;
            db.all(sql, [id], (err, rows) => {
                if (err) reject(err);
                else {
                    const onlineCount = rows.filter(row => 
                        computerClients.has(row.id.toString())
                    ).length;
                    resolve(onlineCount);
                }
            });
        });
    },
};

module.exports = Room;
