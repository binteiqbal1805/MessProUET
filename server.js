const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./messpro.db');


db.serialize(() => {
    
    //db.run("DROP TABLE IF EXISTS users");
     //db.run("DROP TABLE IF EXISTS attendance");

    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, 
        password TEXT, 
        name TEXT, 
        role TEXT DEFAULT 'student'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        date TEXT,
        breakfast INTEGER DEFAULT 0,
        lunch INTEGER DEFAULT 0,
        dinner INTEGER DEFAULT 0
    )`);

    // Default Admin
    db.run(`INSERT OR IGNORE INTO users (username, password, role, name) 
            VALUES ('admin', 'admin123', 'admin', 'System Admin')`);
});;

// --- ADMIN: FETCH ALL ATTENDANCE HISTORY ---
app.get('/api/admin/attendance-history', (req, res) => {
    // We JOIN users and attendance so the admin sees Names instead of just IDs
    const sql = `SELECT a.username, u.name, a.date, a.breakfast, a.lunch, a.dinner 
                 FROM attendance a
                 JOIN users u ON a.username = u.username
                 ORDER BY a.date DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin Stats for Dashboard
app.get('/api/admin/stats', (req, res) => {
    const sql = `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'student') as totalStudents,
        (SELECT COUNT(*) FROM attendance WHERE date = date('now')) as mealsToday`;
    db.get(sql, [], (err, row) => res.json(row));
});
app.post('/api/attendance', (req, res) => {
    const { username, date, breakfast, lunch, dinner } = req.body;
    
    // Check if entry already exists for this date/user
    const checkSql = "SELECT * FROM attendance WHERE username = ? AND date = ?";
    db.get(checkSql, [username, date], (err, existing) => {
        if (existing) {
            // Update existing entry
            const updateSql = "UPDATE attendance SET breakfast=?, lunch=?, dinner=? WHERE username=? AND date=?";
            db.run(updateSql, [breakfast, lunch, dinner, username, date], (err) => {
                if (err) return res.status(500).send(err.message);
                res.status(200).json({ message: "Attendance updated" });
            });
        } else {
            // Insert new record
            const insertSql = "INSERT INTO attendance (username, date, breakfast, lunch, dinner) VALUES (?,?,?,?,?)";
            db.run(insertSql, [username, date, breakfast, lunch, dinner], (err) => {
                if (err) return res.status(500).send(err.message);
                res.status(201).json({ message: "Attendance saved" });
            });
        }
    });
});
app.get('/api/admin/attendance-history', (req, res) => {
    const sql = `SELECT a.*, u.name 
                 FROM attendance a 
                 JOIN users u ON a.username = u.username 
                 ORDER BY a.date DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
// FIXED: Move your billing logic into this route to define 'username'
app.get('/api/admin/generate-bill/:username', (req, res) => {
    const { username } = req.params; // Now username is defined!
    const { month } = req.query;
    
    const sql = `SELECT u.name, SUM(a.breakfast) as b, SUM(a.lunch) as l, SUM(a.dinner) as d 
                 FROM users u 
                 LEFT JOIN attendance a ON u.username = a.username 
                 WHERE u.username = ? AND a.date LIKE ?`;
                 
    db.get(sql, [username, month + '%'], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Admin Server Live on ${PORT}`));