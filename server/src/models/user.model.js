const { db } = require("../db");
const { findById } = require("./room.model");

const User = {
    findByUsername: (username) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE username = ?`;
            db.get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    findByEmail: (email) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE email = ?`;
            db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    create: (user) => {
        return new Promise((resolve, reject) => {
            const { fullname, email, username, password, role } = user;
            const sql = `INSERT INTO users (fullname, email, username, password, role) VALUES (?, ?, ?, ?, ?)`;
            db.run(sql, [fullname, email, username, password, role], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    all: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, fullname, email, username, role FROM users`;
            db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    amount: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount FROM users`;
            db.get(sql, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.amount);
                }
            });
        });
    },
    update: (user) => {
        return new Promise((resolve, reject) => {
            const { id, fullname, email, username, password } = user;
            const sql = `UPDATE users SET fullname = ?, email = ?, username = ?, password = ? WHERE id = ?`;
            db.run(sql, [fullname, email, username, password, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    // Rooms
    getRooms: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT r.id, r.name, r.description
                         FROM rooms r
                         JOIN permissions p ON r.id = p.room_id
                         WHERE p.user_id = ?`;
            db.all(sql, [id], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    amountRooms: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) AS amount
                         FROM rooms r
                         JOIN permissions p ON r.id = p.room_id
                         WHERE p.user_id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.amount);
                }
            });
        });
    },
};

module.exports = User;
