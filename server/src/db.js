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
            fullname TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            role TEXT NOT NULL DEFAULT 'manager'
        )`
        );

        // Create rooms table
        db.run(
            `CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
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

        // Create computers table
        db.run(
            `CREATE TABLE IF NOT EXISTS computers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            row_index INTEGER NOT NULL,
            column_index INTEGER NOT NULL,
            ip_address TEXT NOT NULL,
            mac_address TEXT NOT NULL,
            hostname TEXT NOT NULL,
            notes TEXT DEFAULT NULL,
            errors TEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms (id),
            UNIQUE (room_id, row_index, column_index)
        )`
        );

        // // Create available applications table
        db.run(
            `CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
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
            FOREIGN KEY (installed_by) REFERENCES users(id),
            PRIMARY KEY (computer_id, application_id)
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
        db.run(`INSERT INTO Users (fullname, email, username, password, role) 
                        VALUES ('Admin', 'admin@gmail.com', 'admin', '${hash}', 'admin')
                        ON CONFLICT(email) DO NOTHING`);
    });

    console.log("Database initialized");
};

module.exports = {
    db,
    initDatabase,
};
