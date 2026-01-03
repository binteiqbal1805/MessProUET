const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./messpro.db', (err) => {
    if (err) console.error("Database error:", err.message);
    else console.log("✅ Connected to SQLite Database.");
});

// --- DATABASE INITIALIZATION ---
db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, 
        password TEXT, 
        full_name TEXT, 
        role TEXT DEFAULT 'student', 
        date TEXT
    )`);

    // 2. Attendance Table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT, 
        date TEXT, 
        meal_type TEXT, 
        breakfast INTEGER DEFAULT 0, 
        lunch INTEGER DEFAULT 0, 
        dinner INTEGER DEFAULT 0
    )`);

    // 3. Issues Table (Handles Complaints & Feedback)
    db.run(`CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        type TEXT,      -- 'Complaint' or 'Feedback'
        category TEXT,
        subject TEXT,
        message TEXT,
        date TEXT
    )`);

    // 4. Bills Table (For Revenue Stats)
    db.run(`CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL,
        date TEXT
    )`);

    // 5. Default Admin Creation
    const adminUser = 'admin';
    const adminPass = 'admin123';
    db.get("SELECT * FROM users WHERE username = ?", [adminUser], (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, role, date) VALUES (?, ?, 'admin', ?)", 
            [adminUser, adminPass, new Date().toISOString()]);
        }
    });
});

// --- ROUTES ---

// Login logic
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (row) res.json({ success: true, message: "Welcome!", role: row.role });
        else res.status(401).json({ success: false, error: "Invalid credentials" });
    });
});

// Attendance logic
app.post('/api/attendance', (req, res) => {
    const { username, date, breakfast, lunch, dinner, meal_type } = req.body;
    const sql = `INSERT INTO attendance (username, date, breakfast, lunch, dinner, meal_type) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [username, date, breakfast, lunch, dinner, meal_type], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Attendance saved!" });
    });
});

// NEW: Complaint & Feedback Submission logic
app.post('/api/submit-issue', (req, res) => {
    const { username, type, category, subject, message, date } = req.body;
    const sql = `INSERT INTO issues (username, type, category, subject, message, date) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [username, type, category, subject, message, date || new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: `${type} submitted successfully!`, id: this.lastID });
    });
});

// Dashboard Stats logic
app.get('/api/admin/dashboard-stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role = 'student') as totalStudents,
            (SELECT COUNT(*) FROM attendance WHERE date = ?) as mealsToday,
            (SELECT COUNT(*) FROM issues WHERE type = 'Complaint') as pendingComplaints,
            (SELECT SUM(amount) FROM bills) as monthlyRevenue
    `;
    db.get(sql, [today], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            totalStudents: row.totalStudents || 0,
            mealsToday: row.mealsToday || 0,
            pendingComplaints: row.pendingComplaints || 0,
            monthlyRevenue: row.monthlyRevenue || 0
        });
    });
});

// Recent Activity logic
app.get('/api/recent-activity', (req, res) => {
    db.all("SELECT username, date, meal_type FROM attendance ORDER BY id DESC LIMIT 5", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Serve Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); 
});

const port = 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});