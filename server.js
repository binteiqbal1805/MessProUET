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

// Automatically fix the database schema
db.serialize(() => {
    // Add 'role' column if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'`, (err) => {
        if (!err) console.log("✅ Added 'role' column to users.");
    });
    // Add 'full_name' column for the table display
    db.run(`ALTER TABLE users ADD COLUMN full_name TEXT`, (err) => {
        if (!err) console.log("✅ Added 'full_name' column to users.");
    });
});

// 1. Table Creation
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, date TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS attendance (username TEXT, date TEXT, breakfast INTEGER, lunch INTEGER, dinner INTEGER)");
});

// 2. Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (row) {
            if (row.password === password) {
                return res.status(200).json({ message: "Login successful!" }); // Correct key for alert
            } else {
                return res.status(401).json({ error: "Incorrect password for this ID." });
            }
        }
        db.run("INSERT INTO users VALUES (?, ?, ?)", [username, password, new Date().toISOString()], () => {
            res.status(201).json({ message: "Account created!" });
        });
    });
});

// 3. Attendance POST Route
// Change all SQL queries to use 'attendance' (lowercase)
app.post('/api/attendance', (req, res) => {
    const { username, date, breakfast, lunch, dinner } = req.body;
    const sql = `INSERT INTO attendance (username, date, breakfast, lunch, dinner) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [username, date, breakfast, lunch, dinner], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Attendance saved!" });
    });
});

// 4. Attendance GET Route
app.get('/api/attendance-history/:username', (req, res) => {
    db.all("SELECT * FROM attendance WHERE username = ? ORDER BY date DESC", [req.params.username], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error fetching history" });
        res.json(rows);
    });
});

// Route to handle both Complaints and Feedback
// 1. Create the table automatically if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    type TEXT,
    category TEXT,
    subject TEXT,
    message TEXT,
    date TEXT
)`, (err) => {
    if (err) console.error("Table creation error:", err.message);
    else console.log("Issues table is ready.");
});

// 2. Updated Route to handle the submission
app.post('/api/submit-issue', (req, res) => {
    const { username, type, category, subject, message, date } = req.body;
    
    // Log what is being received to verify data is coming through
    console.log("Saving issue for:", username);

    const sql = `INSERT INTO issues (username, type, category, subject, message, date) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [username, type, category, subject, message, date], function(err) {
        if (err) {
            console.error("❌ Database Insert Error:", err.message);
            // This sends the specific error back to your alert box
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: "Success", id: this.lastID });
    });
});
// Admin Stats Route
app.get('/api/admin/stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Using subqueries to get all counts at once
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

// Recent Activity Route
app.get('/api/admin/activity', (req, res) => {
    db.all(`SELECT username, date FROM attendance ORDER BY id DESC LIMIT 5`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
// Add a new student route
app.post('/api/admin/add-student', (req, res) => {
    const { username, fullName } = req.body;
    const defaultPass = '12345'; 

    // We use a simple insert first to ensure it works with your current schema
    const sql = `INSERT INTO users (username, password, role) VALUES (?, ?, 'student')`;
    
    db.run(sql, [username, defaultPass], function(err) {
        if (err) {
            console.error("❌ Insert Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Student ${username} added to database.`);
        res.status(200).json({ message: "Student created", id: this.lastID });
    });
});

// Get all students route
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT username, role FROM users WHERE role = 'student'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows); // This sends the data to your table
    });
});
// This is the API (The Waiter)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // The Chef checks the SQLite Pantry
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            // Login success!
            res.json({ success: true, message: "Welcome back!" });
        } else {
            // Wrong password - No entry!
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
});
app.get('/api/weekly-attendance', (req, res) => {
    const username = req.query.username; // Get the specific student's name
    
    // SQL query to get data from the last 7 days
    const sql = `SELECT date, meal_type FROM attendance 
                 WHERE username = ? 
                 AND date >= date('now', '-7 days')
                 ORDER BY date DESC`;

    db.all(sql, [username], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows); // Send the list back to the frontend
    });
});
app.get('/api/attendance-stats', (req, res) => {
    const username = req.query.username; // Identification from localStorage
    
    // SQL query to count specific meal types
    const sql = `SELECT 
        COUNT(CASE WHEN meal_type = 'Breakfast' THEN 1 END) as breakfasts,
        COUNT(CASE WHEN meal_type = 'Lunch' THEN 1 END) as lunches,
        COUNT(CASE WHEN meal_type = 'Dinner' THEN 1 END) as dinners,
        COUNT(*) as total 
        FROM attendance WHERE username = ?`;

    db.get(sql, [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row); // Sends the 7, 8, 7 counts back
    });
});
// This route gets the 5 most recent attendance marks
app.get('/api/recent-activity', (req, res) => {
    const sql = `SELECT student_id, name, date, meal_type as last_action 
                 FROM attendance 
                 ORDER BY date DESC LIMIT 5`;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows); // Send the data to the dashboard
    });
});
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));



// 1. Tell Express where your HTML/CSS files are
app.use(express.static(path.join(__dirname)));

// 2. Tell Express to show your login page at the root URL (/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); 
});
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});