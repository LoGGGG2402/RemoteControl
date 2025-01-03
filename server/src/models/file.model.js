const { db } = require("../configs/db");

const File = {
    create: (file) => {
        return new Promise((resolve, reject) => {
            const { name, file_path, description, created_by } = file;
            const sql = `INSERT INTO files (name, file_path, description, created_by) VALUES (?, ?, ?, ?)`;
            db.run(sql, [name, file_path, description, created_by], (err) => {
                if (err) reject(err);
                else {
                    db.get("SELECT last_insert_rowid() as id", (err, row) => {
                        if (err) reject(err);
                        else resolve(row.id);
                    });
                }
            });
        });
    },

    findById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT f.*, u.full_name, u.email 
                        FROM files f
                        JOIN users u ON f.created_by = u.id
                        WHERE f.id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    all: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT f.*, u.full_name, u.email 
                        FROM files f
                        JOIN users u ON f.created_by = u.id
                        ORDER BY f.created_at DESC`;
            db.all(sql, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    delete: (id) => {
        return new Promise((resolve, reject) => {
            db.run("BEGIN TRANSACTION");
            db.run("DELETE FROM installed_files WHERE file_id = ?",
                [id],
                (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                    }

                    db.run("DELETE FROM files WHERE id = ?", [id], (err) => {
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

    update: (id, data) => {
        const { name, description, file_path } = data;
        const sql = `UPDATE files SET name = ?, description = ?, file_path = ? WHERE id = ?`;
        return db.run(sql, [name, description, file_path, id]);
    }
};

module.exports = File; 