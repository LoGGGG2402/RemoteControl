const sqlite3 = require("sqlite3");
const config = require("./config");
const bcrypt = require("bcrypt");

const db = new sqlite3.Database(config.databasePath, (err) => {
    if (err) {
        console.error("Error opening database", err);
    } else {
        console.log("Database connected");
    }
});

const initDatabase = () => {
    // Create users table
    try {
        db.run(
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'manager',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );

        // Create rooms table
        db.run(
            `CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                row_count INTEGER NOT NULL,
                column_count INTEGER NOT NULL,
                description TEXT
            )`
        );

        // Create permissions table
        db.run(
            `CREATE TABLE IF NOT EXISTS permissions (
                user_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL,
                can_view INTEGER DEFAULT 0,
                can_manage INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES Users(id),
                FOREIGN KEY (room_id) REFERENCES Rooms(id),
                PRIMARY KEY (user_id, room_id)
            )`
        );

        // Sửa bảng computers, bỏ cột errors
        db.run(`
            CREATE TABLE IF NOT EXISTS computers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                row_index INTEGER NOT NULL, 
                column_index INTEGER NOT NULL,
                ip_address TEXT NOT NULL,
                mac_address TEXT NOT NULL,
                hostname TEXT NOT NULL,
                notes TEXT DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms (id),
                UNIQUE (room_id, row_index, column_index)
            )
        `);

        // Tạo bảng computer_errors
        db.run(`
            CREATE TABLE IF NOT EXISTS computer_errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                computer_id INTEGER NOT NULL,
                error_type TEXT NOT NULL CHECK(error_type IN ('hardware', 'software', 'network', 'system', 'security', 'peripheral')),
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP DEFAULT NULL,
                FOREIGN KEY (computer_id) REFERENCES computers(id)
            )
        `);

        // Create available applications table
        db.run(
            `CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT DEFAULT NULL,
                version TEXT DEFAULT NULL
            )`
        );

        // Create installed applications table
        db.run(
            `CREATE TABLE IF NOT EXISTS installed_applications (
                computer_id INTEGER NOT NULL,
                application_id INTEGER NOT NULL,
                installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                installed_by INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (computer_id) REFERENCES computers(id),
                FOREIGN KEY (application_id) REFERENCES applications(id),
                PRIMARY KEY (computer_id, application_id)
            )`
        );

        // Create files table
        db.run(
            `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                file_path TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER NOT NULL,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`
        );

        // Create installed files table
        db.run(
            `CREATE TABLE IF NOT EXISTS installed_files (
                computer_id INTEGER NOT NULL,
                file_id INTEGER NOT NULL,
                installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                installed_by INTEGER NOT NULL,
                FOREIGN KEY (computer_id) REFERENCES computers(id),
                FOREIGN KEY (file_id) REFERENCES files(id),
                FOREIGN KEY (installed_by) REFERENCES users(id),
                PRIMARY KEY (computer_id, file_id)
            )`
        );
    } catch (err) {
        console.error("Error creating tables:", err);
    }

    let defaultAdminPassword = "pass";
    bcrypt.hash(defaultAdminPassword, 10, (err, hash) => {
        if (err) {
            console.error("Error hashing default admin password:", err);
            return;
        }

        // Create default admin user if not exists
        db.run(`INSERT INTO Users (full_name, email, password, role)
                        VALUES ('SUPPER ADMIN', 'admin@gmail.com', '${hash}', 'admin')
                        ON CONFLICT(email) DO NOTHING`);
    });

    console.log("Database initialized");
};

module.exports = {
    db,
    initDatabase,
};
