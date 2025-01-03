const { db } = require("../configs/db");

const Permission = {
    create: (permission) => {
        return new Promise((resolve, reject) => {
            const { user_id, room_id, can_view, can_manage } = permission;
            const sql = `INSERT INTO permissions (user_id, room_id, can_view, can_manage) VALUES (?, ?, ?, ?)`;
            db.run(sql, [user_id, room_id, can_view, can_manage], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    findByUserAndRoom: (user_id, room_id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM permissions WHERE user_id = ? AND room_id = ?`;
            db.get(sql, [user_id, room_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    all: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM permissions`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    update: (permission) => {
        return new Promise((resolve, reject) => {
            const { user_id, room_id, can_view, can_manage } = permission;
            const sql = `UPDATE permissions SET can_view = ?, can_manage = ? WHERE user_id = ? AND room_id = ?`;
            db.run(sql, [can_view, can_manage, user_id, room_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    delete: (user_id, room_id) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM permissions WHERE user_id = ? AND room_id = ?`;
            db.run(sql, [user_id, room_id], (err) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else resolve();
            });
        });
    },
};

module.exports = Permission;
