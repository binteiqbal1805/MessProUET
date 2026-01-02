const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create or open the messpro.db file
const db = new sqlite3.Database('./messpro.db');

// Initialize tables to match your Viewer
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, 
        password TEXT, 
        date TEXT,
        role TEXT DEFAULT 'student',
        full_name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        date TEXT,
        breakfast INTEGER DEFAULT 0,
        lunch INTEGER DEFAULT 0,
        dinner INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        type TEXT,
        category TEXT,
        subject TEXT,
        message TEXT,
        date TEXT,
        status TEXT DEFAULT 'Pending'
    )`);
});

// LOGIN: Matches student101 / 1234 from your screenshot
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (row && row.password === password) {
            res.json({ success: true, role: row.role });
        } else {
            res.status(401).json({ success: false, message: "Invalid login" });
        }
    });
});

// ATTENDANCE: Records the 1s and 0s
app.post('/api/attendance', (req, res) => {
    const { username, date, breakfast, lunch, dinner } = req.body;
    db.run(`INSERT INTO attendance (username, date, breakfast, lunch, dinner) VALUES (?, ?, ?, ?, ?)`,
        [username, date, breakfast, lunch, dinner], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Attendance saved!" });
        });
});

// ADMIN STATS: Counts students and complaints
app.get('/api/admin/stats', (req, res) => {
    db.get(`SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'student') as totalStudents,
        (SELECT COUNT(*) FROM issues WHERE status = 'Pending') as activeComplaints`, 
    (err, row) => {
        res.json(row);
    });
});
// Submit Complaint to SQLite
app.post('/api/submit-issue', (req, res) => {
    const { username, type, category, subject, message, date } = req.body;
    const sql = `INSERT INTO issues (username, type, category, subject, message, date) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [username, type, category, subject, message, date], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // Returns the ID of the new row
        res.json({ message: "success", id: this.lastID });
    });
});
app.get('/api/admin/generate-bill/:username', (req, res) => {
    const { username } = req.params;
    const { month } = req.query; // Comes from the <input type="month"> (YYYY-MM)

    // Query to join users (for the name) and attendance (for the counts)
    const sql = `
        SELECT 
            u.full_name as name,
            SUM(a.breakfast) as b_total,
            SUM(a.lunch) as l_total,
            SUM(a.dinner) as d_total
        FROM users u
        LEFT JOIN attendance a ON u.username = a.username
        WHERE u.username = ? AND a.date LIKE ?
        GROUP BY u.username
    `;

    // The '%' allows us to match any date starting with the chosen month (e.g., '2025-12%')
    db.get(sql, [username, `${month}%`], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "No data found" });

        // Calculate totals (Example rates: B=30, L=50, D=50)
        const b_total = row.b_total || 0;
        const l_total = row.l_total || 0;
        const d_total = row.d_total || 0;
        const totalAmount = (b_total * 30) + (l_total * 50) + (d_total * 50);

        res.json({
            name: row.name || username,
            month: month,
            b_total: b_total,
            l_total: l_total,
            d_total: d_total,
            totalAmount: totalAmount
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));