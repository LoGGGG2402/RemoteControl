const { db } = require("../configs/db");
const { computerClients } = require('../utils/agentCommunication');

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

            db.run(sql1, [room_id, row_index, column_index, ip_address, mac_address, hostname], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    reject(err);
                } else {
                    db.run("COMMIT");
                    resolve(this.lastID); // Use this.lastID to get the newly inserted row ID
                }
            });
        });
    },
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT computers.*, computer_errors.id as error_id, computer_errors.error_type, computer_errors.description, computer_errors.created_at, computer_errors.resolved_at
                        FROM computers
                        LEFT JOIN computer_errors ON computers.id = computer_errors.computer_id
                        WHERE computers.id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else if (row) {
                    row.online = computerClients.has(row.id.toString());
                    resolve(row);
                }
                else resolve(null);
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
            const sql = `
                SELECT computers.*, 
                       (SELECT COUNT(*) 
                        FROM computer_errors 
                        WHERE computer_errors.computer_id = computers.id 
                        AND computer_errors.resolved_at IS NULL) as error_count
                FROM computers`;
            db.all(sql, (err, rows) => {
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
            const sql = `SELECT COUNT(DISTINCT computers.id) AS amount 
                        FROM computers 
                        JOIN computer_errors ON computers.id = computer_errors.computer_id
                        WHERE computer_errors.resolved_at IS NULL`;
            db.get(sql, (err, row) => {
                if (err) reject(err);
                else resolve(row.amount); 
            });
        });
    },
    amountOnline: () => {
        return new Promise((resolve, reject) => {
            resolve(computerClients.size);
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
                function(err) {
                    if (err) reject(err);
                    else {
                        // Check if the update actually affected any rows
                        if (this.changes > 0) {
                            resolve(id);
                        } else {
                            reject(new Error("No records were updated"));
                        }
                    }
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
            resolve(computerClients.has(id.toString()));
        });
    },

    updateNotes: (id, notes) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE computers SET notes = ?, updated_at = datetime('now') WHERE id = ?`;
            db.run(sql, [notes, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    addError: (computer_id, error_type, description) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO computer_errors (computer_id, error_type, description) 
                        VALUES (?, ?, ?)`;
            db.run(sql, [computer_id, error_type, description], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    resolveError: (error_id) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE computer_errors 
                        SET resolved_at = datetime('now')
                        WHERE id = ?`;
            db.run(sql, [error_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    getErrors: (computer_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM computer_errors 
                        WHERE computer_id = ? 
                        ORDER BY created_at DESC`;
            db.all(sql, [computer_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    hasErrors: (computer_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) as count FROM computer_errors
                        WHERE computer_id = ? AND resolved_at IS NULL`;
            db.get(sql, [computer_id], (err, row) => {
                if (err) reject(err);
                else resolve(row.count > 0);
            });
        });
    },

    // File management
    installFile: (computer_id, file_id, installed_by) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO installed_files (computer_id, file_id, installed_by) VALUES (?, ?, ?)`;
            db.run(sql, [computer_id, file_id, installed_by], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    removeFile: (computer_id, file_id) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM installed_files WHERE computer_id = ? AND file_id = ?`;
            db.run(sql, [computer_id, file_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    getFiles: (computer_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT f.*, if.installed_at, u.full_name, u.email
                        FROM files f
                        JOIN installed_files if ON f.id = if.file_id
                        JOIN users u ON if.installed_by = u.id
                        WHERE if.computer_id = ?`;
            db.all(sql, [computer_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    isInstalledFile: (computer_id, file_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount
                        FROM installed_files
                        WHERE computer_id = ? AND file_id = ?`;
            db.get(sql, [computer_id, file_id], (err, row) => {
                if (err) reject(err);
                else {
                    resolve(row.amount > 0);
                }
            });
        });
    },

    updateListFileAndApplication: async (computerId, listFile, listApplication) => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION', (transactionErr) => {
                    if (transactionErr) {
                        return reject(transactionErr);
                    }
                    
                    const processApplications = () => {
                        // Get all available applications
                        const sqlAvailableApps = `SELECT * FROM applications`;
                        db.all(sqlAvailableApps, [], async (err, availableApplications) => {
                            if (err) {
                                return db.run('ROLLBACK', () => reject(err));
                            }
                            
                            // Get installed applications for this computer
                            const sqlInstalledApps = `
                                SELECT a.id, a.name, ia.installed_at, u.full_name, u.email
                                FROM applications a
                                JOIN installed_applications ia ON a.id = ia.application_id
                                JOIN users u ON ia.installed_by = u.id
                                WHERE ia.computer_id = ?
                            `;
                            db.all(sqlInstalledApps, [computerId], async (err, installedApplications) => {
                                if (err) {
                                    return db.run('ROLLBACK', () => reject(err));
                                }
                                
                                try {
                                    // Handle new applications to install
                                    const installPromises = [];
                                    for (const appName of listApplication) {
                                        const availableApp = availableApplications.find(a => a.name === appName);
                                        if (availableApp) {
                                            const installedApp = installedApplications.find(a => a.name === appName);
                                            if (!installedApp) {
                                                const installPromise = new Promise((resolve, reject) => {
                                                    const sqlInstall = `
                                                        INSERT INTO installed_applications (computer_id, application_id, installed_by) 
                                                        VALUES (?, ?, ?)
                                                    `;
                                                    db.run(sqlInstall, [computerId, availableApp.id, 1], (err) => {
                                                        if (err) reject(err);
                                                        else resolve();
                                                    });
                                                });
                                                installPromises.push(installPromise);
                                            }
                                        }
                                    }
                                    
                                    // Handle applications to remove
                                    const removePromises = [];
                                    for (const app of installedApplications) {
                                        if (!listApplication.includes(app.name)) {
                                            const removePromise = new Promise((resolve, reject) => {
                                                const sqlRemove = `
                                                    DELETE FROM installed_applications 
                                                    WHERE computer_id = ? AND application_id = ?
                                                `;
                                                db.run(sqlRemove, [computerId, app.id], (err) => {
                                                    if (err) reject(err);
                                                    else resolve();
                                                });
                                            });
                                            removePromises.push(removePromise);
                                        }
                                    }
                                    
                                    // Wait for all app operations to complete
                                    Promise.all([...installPromises, ...removePromises])
                                        .then(() => {
                                            processFiles();
                                        })
                                        .catch(error => {
                                            db.run('ROLLBACK', () => reject(error));
                                        });
                                } catch (error) {
                                    db.run('ROLLBACK', () => reject(error));
                                }
                            });
                        });
                    };
                    
                    const processFiles = () => {
                        // Get all available files
                        const sqlAvailableFiles = `SELECT * FROM files`;
                        db.all(sqlAvailableFiles, [], async (err, availableFiles) => {
                            if (err) {
                                return db.run('ROLLBACK', () => reject(err));
                            }
                            
                            // Get installed files for this computer
                            const sqlInstalledFiles = `
                                SELECT f.*, if.installed_at, u.full_name, u.email
                                FROM files f
                                JOIN installed_files if ON f.id = if.file_id
                                JOIN users u ON if.installed_by = u.id
                                WHERE if.computer_id = ?
                            `;
                            db.all(sqlInstalledFiles, [computerId], async (err, installedFiles) => {
                                if (err) {
                                    return db.run('ROLLBACK', () => reject(err));
                                }
                                
                                try {
                                    // Handle new files to install
                                    const installPromises = [];
                                    for (const fileName of listFile) {
                                        const availableFile = availableFiles.find(f => f.name === fileName);
                                        if (availableFile) {
                                            const installedFile = installedFiles.find(f => f.name === fileName);
                                            if (!installedFile) {
                                                const installPromise = new Promise((resolve, reject) => {
                                                    const sqlInstall = `
                                                        INSERT INTO installed_files (computer_id, file_id, installed_by) 
                                                        VALUES (?, ?, ?)
                                                    `;
                                                    db.run(sqlInstall, [computerId, availableFile.id, 1], (err) => {
                                                        if (err) reject(err);
                                                        else resolve();
                                                    });
                                                });
                                                installPromises.push(installPromise);
                                            }
                                        }
                                    }
                                    
                                    // Handle files to remove
                                    const removePromises = [];
                                    for (const file of installedFiles) {
                                        if (!listFile.includes(file.name)) {
                                            const removePromise = new Promise((resolve, reject) => {
                                                const sqlRemove = `
                                                    DELETE FROM installed_files 
                                                    WHERE computer_id = ? AND file_id = ?
                                                `;
                                                db.run(sqlRemove, [computerId, file.id], (err) => {
                                                    if (err) reject(err);
                                                    else resolve();
                                                });
                                            });
                                            removePromises.push(removePromise);
                                        }
                                    }
                                    
                                    // Wait for all file operations to complete
                                    Promise.all([...installPromises, ...removePromises])
                                        .then(() => {
                                            // Commit transaction if all operations succeed
                                            db.run('COMMIT', (err) => {
                                                if (err) {
                                                    db.run('ROLLBACK', () => reject(err));
                                                } else {
                                                    resolve();
                                                }
                                            });
                                        })
                                        .catch(error => {
                                            db.run('ROLLBACK', () => reject(error));
                                        });
                                } catch (error) {
                                    db.run('ROLLBACK', () => reject(error));
                                }
                            });
                        });
                    };
                    
                    // Start the process
                    processApplications();
                });
            });
        });
    },
};

module.exports = Computer;
