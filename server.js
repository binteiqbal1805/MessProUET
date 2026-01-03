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
const isAdmin = (req, res, next) => {
    const { username } = req.headers; // Or use a session/token
    db.get("SELECT role FROM users WHERE username = ?", [username], (err, row) => {
        if (row && row.role === 'admin') {
            next(); // User is admin, proceed to the route
        } else {
            res.status(403).send("Access Denied: Admins Only");
        }
    });
};

// Apply this to all admin routes
app.get('/api/admin/stats', isAdmin, (req, res) => {
    // ... existing stats logic ...
});
// ... (previous imports and setup)



db.serialize(() => {
    // Standard User Table
    db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, name TEXT, role TEXT DEFAULT 'student')`);
    db.run(`INSERT OR IGNORE INTO users (username, password, role, name) 
        VALUES ('admin', 'admin123', 'admin', 'System Admin')`);
    
    // NEW: Login Activity Table to store dynamic login data
    db.run(`CREATE TABLE IF NOT EXISTS login_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT, 
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
});

// MODIFIED LOGIN ROUTE: Now stores data on every entry
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // 1. Check if user exists
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (user) {
            // 2. LOG THE ACTIVITY: Every time they log in, insert a new record
            db.run("INSERT INTO login_activity (username) VALUES (?)", [username]);
            
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
});

// ADMIN ROUTE: Get all dynamic login activity
app.get('/api/admin/all-logins', (req, res) => {
    const sql = `SELECT l.username, u.name, l.login_time 
                 FROM login_activity l 
                 JOIN users u ON l.username = u.username 
                 ORDER BY l.login_time DESC`;
    db.all(sql, [], (err, rows) => {
        res.json(rows);
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));