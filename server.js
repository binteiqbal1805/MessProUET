const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./messpro.db');

db.serialize(() => {
    // 1. Core Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, 
        password TEXT, 
        name TEXT, 
        role TEXT DEFAULT 'student'
    )`);

    // 2. Attendance Table (Matches your frontend image_cf672a)
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        date TEXT,
        breakfast INTEGER DEFAULT 0,
        lunch INTEGER DEFAULT 0,
        dinner INTEGER DEFAULT 0
    )`);

    // Ensure Admin exists
    db.run(`INSERT OR IGNORE INTO users (username, password, role, name) 
            VALUES ('admin', 'admin123', 'admin', 'System Admin')`);
});

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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Admin Server Live on ${PORT}`));