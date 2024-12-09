const { db } = require("../db");

const Computer = {
    create: (computer) => {
        return new Promise((resolve, reject) => {
            const {
                room_id,
                row_index,
                column_index,
                ip_address,
                mac_address,
                hostname,
            } = computer;
            db.run("BEGIN TRANSACTION");

            const sql1 = `INSERT INTO computers (room_id, row_index, column_index, ip_address, mac_address, hostname) 
                        VALUES (?, ?, ?, ?, ?, ?)`;

            const sql2 = `INSERT INTO heartbeatd_computers (computer_id) VALUES (last_insert_rowid())
                          ON CONFLICT(computer_id) DO NOTHING`;

            db.run(
                sql1,
                [
                    room_id,
                    row_index,
                    column_index,
                    ip_address,
                    mac_address,
                    hostname,
                ],
                (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                    }

                    db.run(sql2, [], (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return reject(err);
                        }

                        db.run("COMMIT", (err) => {
                            if (err) reject(err);
                            else {
                                db.get(
                                    "SELECT last_insert_rowid() as id",
                                    (err, row) => {
                                        if (err) reject(err);
                                        else resolve(row.id);
                                    }
                                );
                            }
                        });
                    });
                }
            );
        });
    },
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT *, (heartbeatd_at > datetime('now', '-1 minutes')) as online
                        FROM computers JOIN heartbeatd_computers ON computers.id = heartbeatd_computers.computer_id
                        WHERE id = ?`;
            db.get(sql, [id], (err, row) => {
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
            const sql = `SELECT *, (heartbeatd_at > datetime('now', '-1 minutes')) as online, (errors IS NOT NULL) as error
                            FROM computers JOIN heartbeatd_computers ON computers.id = heartbeatd_computers.computer_id`;
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
            const sql = `SELECT COUNT(*) AS amount FROM heartbeatd_computers WHERE heartbeatd_at > datetime('now', '-5 minutes')`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    update: (computer) => {
        return new Promise((resolve, reject) => {
            const {
                id,
                room_id,
                row_index,
                column_index,
                ip_address,
                mac_address,
                hostname,
            } = computer;
            const updated_at = new Date().toISOString();
            const sql = `UPDATE computers SET room_id = ?, row_index = ?, column_index = ?, ip_address = ?, mac_address = ?, hostname = ?, updated_at = ?
                        WHERE id = ?`;
            db.run(
                sql,
                [
                    room_id,
                    row_index,
                    column_index,
                    ip_address,
                    mac_address,
                    hostname,
                    updated_at,
                    id,
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve(computer.id);
                }
            );
        });
    },
    delete: (id) => {
        return new Promise((resolve, reject) => {
            // delete computer by id and all its installed applications
            db.run("BEGIN TRANSACTION");
            db.run(
                "DELETE FROM installed_applications WHERE computer_id = ?",
                [id],
                (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                    }

                    db.run(
                        "DELETE FROM heartbeatd_computers WHERE computer_id = ?",
                        [id],
                        (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                return reject(err);
                            }

                            db.run(
                                "DELETE FROM computers WHERE id = ?",
                                [id],
                                (err) => {
                                    if (err) {
                                        db.run("ROLLBACK");
                                        return reject(err);
                                    }

                                    db.run("COMMIT", (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    });
                                }
                            );
                        }
                    );
                }
            );
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
            const sql = `SELECT a.id, a.name, ia.installed_at, u.full_name, u.email
                         FROM applications a
                         JOIN installed_applications ia ON a.id = ia.application_id
                         JOIN users u ON ia.installed_by = u.id
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
                else {
                    resolve(row.amount > 0);
                }
            });
        });
    },

    // heartbeat
    heartbeat: (computer_id) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE heartbeatd_computers SET heartbeatd_at = datetime('now') WHERE computer_id = ?`;
            db.run(sql, [computer_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    isOnline: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT (heartbeatd_at > datetime('now', '-1 minutes')) as online 
                        FROM heartbeatd_computers 
                        WHERE computer_id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.online === 1 : false);
            });
        });
    },
};

module.exports = Computer;
