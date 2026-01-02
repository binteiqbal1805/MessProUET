const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// 1. Database Connection
const db = new sqlite3.Database('./messpro.db', (err) => {
    if (err) console.error("Database error:", err.message);
    else console.log("✅ Connected to SQLite Database.");
});

// 2. Table Creation & Schema Updates
db.serialize(() => {
    
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, 
        password TEXT, 
        role TEXT DEFAULT 'student', 
        full_name TEXT, 
        date TEXT
    )`);

    // Attendance Table (With ID for Activity tracking)
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT, 
        date TEXT, 
        breakfast INTEGER DEFAULT 0, 
        lunch INTEGER DEFAULT 0, 
        dinner INTEGER DEFAULT 0
    )`);

    // Issues/Complaints Table
    db.run(`CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        type TEXT,
        category TEXT,
        subject TEXT,
        message TEXT,
        date TEXT
    )`);
});

// 3. Authentication Route (Handles Login & Auto-Registration)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        
        if (row) {
            if (row.password === password) {
                return res.status(200).json({ success: true, message: "Login successful!" });
            } else {
                return res.status(401).json({ success: false, error: "Incorrect password." });
            }
        }
        
        // Auto-create account if student doesn't exist
        db.run("INSERT INTO users (username, password, date) VALUES (?, ?, ?)", 
            [username, password, new Date().toISOString()], () => {
            res.status(201).json({ success: true, message: "Account created!" });
        });
    });
});

// 4. Attendance Submission
app.post('/api/attendance', (req, res) => {
    const { username, date, breakfast, lunch, dinner } = req.body;
    const sql = `INSERT INTO attendance (username, date, breakfast, lunch, dinner) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [username, date, breakfast, lunch, dinner], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Attendance saved!" });
    });
});

// 5. Student Dashboard: History
app.get('/api/attendance-history/:username', (req, res) => {
    db.all("SELECT * FROM attendance WHERE username = ? ORDER BY date DESC", [req.params.username], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error fetching history" });
        res.json(rows);
    });
});

// 6. Student Dashboard: Stats (Counting the 1s in columns)
app.get('/api/attendance-stats', (req, res) => {
    const { username } = req.query;
    // This query sums the 1s in your database columns
    const sql = `SELECT 
        SUM(breakfast) as breakfasts, 
        SUM(lunch) as lunches, 
        SUM(dinner) as dinners 
        FROM attendance WHERE username = ?`;
    
    db.get(sql, [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            breakfasts: row.breakfasts || 0,
            lunches: row.lunches || 0,
            dinners: row.dinners || 0,
            total: (row.breakfasts || 0) + (row.lunches || 0) + (row.dinners || 0)
        });
    });
});

// 7. Complaints/Feedback Submission
app.post('/api/submit-issue', (req, res) => {
    const { username, type, category, subject, message, date } = req.body;
    const sql = `INSERT INTO issues (username, type, category, subject, message, date) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [username, type, category, subject, message, date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: "Success", id: this.lastID });
    });
});

// 8. Admin: Dashboard Stats
app.get('/api/admin/stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = `SELECT 
        (SELECT COUNT(DISTINCT username) FROM users) as totalStudents,
        (SELECT COUNT(*) FROM attendance WHERE date = ?) as mealsToday,
        (SELECT COUNT(*) FROM attendance) as mealsMonth,
        (SELECT COUNT(*) FROM issues WHERE type = 'Complaint') as complaints`;
    db.get(sql, [today], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// 9. Admin: Recent Activity (Combines meal columns into one string)
app.get('/api/admin/activity', (req, res) => {
    const sql = `SELECT username, date, 
        (CASE WHEN breakfast=1 THEN 'B ' ELSE '' END || 
         CASE WHEN lunch=1 THEN 'L ' ELSE '' END || 
         CASE WHEN dinner=1 THEN 'D' ELSE '' END) as last_action
        FROM attendance ORDER BY id DESC LIMIT 5`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 10. Admin: Get All Students
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT username, role FROM users WHERE role = 'student'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Serve Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));