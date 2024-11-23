const db = require("../db");

const Room = {
    create: (room) => {
        return new Promise((resolve, reject) => {
            const { name, description } = room;
            const sql = `INSERT INTO rooms (name, description) VALUES (?, ?)`;
            db.run(sql, [name, description], (err) => {
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
            const { id, name, description } = room;
            const sql = `UPDATE rooms SET name = ?, description = ? WHERE id = ?`;
            db.run(sql, [name, description, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    delete: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM permissions WHERE room_id = ?;
                         DELETE FROM computers WHERE room_id = ?;`;
            db.run(sql, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    // Permissions
    getUsers: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT u.id, u.fullname, u.email, u.username, u.role
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
            const sql = `SELECT * FROM computers WHERE room_id = ? ORDER BY index`;
            db.all(sql, [id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    getComputersInstalled: (id, application_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT c.id, c.index, c.ip_address, c.mac_address, c.hostname, c.notes, c.errors, c.updated_at
                     FROM computers c
                     JOIN installed_applications ia ON c.id = ia.computer_id
                     WHERE c.room_id = ? AND ia.application_id = ?`;
            db.all(sql, [id, application_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

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
            const sql = `SELECT COUNT(*) AS amount FROM computers WHERE room_id = ? AND errors IS NOT NULL`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
    amountOnline: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM computers WHERE room_id = ? AND updated_at >= datetime('now', '-10 minutes')`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.amount);
            });
        });
    },
};

module.exports = Room;
