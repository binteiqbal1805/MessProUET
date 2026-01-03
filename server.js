const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./messpro.db');

// --- DATABASE TABLES ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT DEFAULT '1234', name TEXT, room_no TEXT, plan_type TEXT, role TEXT DEFAULT 'student')`);
    db.run(`CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, date TEXT, breakfast INTEGER DEFAULT 0, lunch INTEGER DEFAULT 0, dinner INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS issues (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, status TEXT DEFAULT 'Pending')`);
});

// --- ADMIN API ROUTES ---

// 1. Dashboard Stats
app.get('/api/admin/stats', (req, res) => {
    const sql = `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'student') as totalStudents,
        (SELECT COUNT(*) FROM attendance WHERE date = date('now')) as mealsToday,
        (SELECT COUNT(*) FROM issues WHERE status = 'Pending') as activeComplaints`;
    db.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { totalStudents: 0, mealsToday: 0, activeComplaints: 0 });
    });
});

// 2. Full Activity (JOINing users and attendance)
app.get('/api/admin/activity', (req, res) => {
    const sql = `SELECT a.username, u.name, a.date, 
                (CASE WHEN a.breakfast=1 THEN 'B ' ELSE '' END || 
                 CASE WHEN a.lunch=1 THEN 'L ' ELSE '' END || 
                 CASE WHEN a.dinner=1 THEN 'D' ELSE '' END) as last_action
                 FROM attendance a
                 JOIN users u ON a.username = u.username
                 ORDER BY a.date DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Billing (FIXED LINE 138: Wrapped in app.get and defined variables)
app.get('/api/admin/generate-bill/:username', (req, res) => {
    const username = req.params.username; // Variable now defined from the URL
    const month = req.query.month;       // Variable now defined from query string
    
    const sql = `SELECT u.name, SUM(a.breakfast) as b, SUM(a.lunch) as l, SUM(a.dinner) as d 
                 FROM users u 
                 LEFT JOIN attendance a ON u.username = a.username 
                 WHERE u.username = ? AND a.date LIKE ? 
                 GROUP BY u.username`;

    db.get(sql, [username, month + '%'], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "No data found" });
        
        const total = (row.b * 30) + (row.l * 50) + (row.d * 50);
        res.json({ name: row.name, totalAmount: total });
    });
});

// 4. User Management
app.get('/api/admin/users', (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'student'", [], (err, rows) => res.json(rows));
});

app.delete('/api/admin/users/:username', (req, res) => {
    db.run("DELETE FROM users WHERE username = ?", [req.params.username], () => res.sendStatus(200));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));