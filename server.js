const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./messpro.db');

// Database Setup
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, 
        password TEXT DEFAULT '1234', 
        name TEXT, 
        room_no TEXT, 
        plan_type TEXT,
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

    db.run(`CREATE TABLE IF NOT EXISTS inventory (
        item_name TEXT PRIMARY KEY,
        quantity REAL,
        unit TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Routes
app.post('/api/users', (req, res) => {
    const { username, name, room_no, plan_type } = req.body;
    db.run(`INSERT INTO users (username, name, room_no, plan_type) VALUES (?, ?, ?, ?)`, 
    [username, name, room_no, plan_type], (err) => {
        if (err) return res.status(500).send("User exists");
        res.status(200).send("Success");
    });
});

app.get('/api/admin/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => res.json(rows));
});

app.post('/api/attendance', (req, res) => {
    const { username, date, breakfast, lunch, dinner } = req.body;
    db.run(`INSERT INTO attendance (username, date, breakfast, lunch, dinner) VALUES (?, ?, ?, ?, ?)`,
    [username, date, breakfast, lunch, dinner], () => res.json({msg: "Saved"}));
});

app.get('/api/admin/activity', (req, res) => {
    const sql = `SELECT a.username, u.name, a.date, 
                (CASE WHEN a.breakfast=1 THEN 'B ' ELSE '' END || 
                 CASE WHEN a.lunch=1 THEN 'L ' ELSE '' END || 
                 CASE WHEN a.dinner=1 THEN 'D' ELSE '' END) as last_action
                 FROM attendance a JOIN users u ON a.username = u.username ORDER BY a.date DESC`;
    db.all(sql, [], (err, rows) => res.json(rows));
});

app.get('/api/inventory', (req, res) => {
    db.all("SELECT * FROM inventory", [], (err, rows) => res.json(rows));
});

app.post('/api/inventory/update', (req, res) => {
    const { item_name, quantity, unit } = req.body;
    db.run(`INSERT INTO inventory (item_name, quantity, unit) VALUES (?, ?, ?) 
            ON CONFLICT(item_name) DO UPDATE SET quantity=excluded.quantity, unit=excluded.unit, last_updated=CURRENT_TIMESTAMP`,
    [item_name, quantity, unit], () => res.send("Updated"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));