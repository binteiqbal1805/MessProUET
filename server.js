const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Database Connection
const pool = new Pool({
    connectionString: "postgresql://messpro_db_user:D9pVqaCoshpu8uQt0PqKuC3dLKMn4ssQ@dpg-d5boc4je5dus73frqe6g-a.virginia-postgres.render.com/messpro_db",
    ssl: { rejectUnauthorized: false }
});

// 2. Initialize Permanent Tables
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT,
                name TEXT,
                room_no TEXT,
                plan_type TEXT,
                status TEXT DEFAULT 'Active',
                role TEXT DEFAULT 'student'
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                username TEXT REFERENCES users(username),
                date TEXT,
                breakfast INTEGER DEFAULT 0,
                lunch INTEGER DEFAULT 0,
                dinner INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS issues (
                id SERIAL PRIMARY KEY,
                username TEXT,
                type TEXT,
                category TEXT,
                subject TEXT,
                message TEXT,
                date TEXT,
                status TEXT DEFAULT 'Pending'
            );
        `);
        console.log("✅ PostgreSQL Tables Ready");
    } catch (err) { console.error("DB Init Error:", err); }
}
initDB();

// 3. Authentication & Auto-Registration
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length > 0) {
            if (user.rows[0].password === password) {
                return res.json({ success: true, role: user.rows[0].role });
            }
            return res.status(401).json({ success: false, error: "Wrong password" });
        }
        // Auto-create if student doesn't exist
        await pool.query('INSERT INTO users (username, password, name, status) VALUES ($1, $2, $3, $4)', 
            [username, password, 'New Student', 'Active']);
        res.json({ success: true, message: "Account Created" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Attendance Submission
app.post('/api/attendance', async (req, res) => {
    const { username, date, breakfast, lunch, dinner } = req.body;
    try {
        await pool.query(
            'INSERT INTO attendance (username, date, breakfast, lunch, dinner) VALUES ($1, $2, $3, $4, $5)',
            [username, date, breakfast, lunch, dinner]
        );
        res.json({ message: "Attendance Saved" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Admin Dashboard Stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'student') as totalstudents,
                (SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE::text) as mealstoday,
                (SELECT COUNT(*) FROM issues WHERE status = 'Pending') as complaints
        `);
        res.json(stats.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Admin Recent Activity (JOIN)
app.get('/api/admin/activity', async (req, res) => {
    try {
        const activity = await pool.query(`
            SELECT u.username, u.name, a.date,
            (CASE WHEN a.breakfast = 1 THEN 'B ' ELSE '' END || 
             CASE WHEN a.lunch = 1 THEN 'L ' ELSE '' END || 
             CASE WHEN a.dinner = 1 THEN 'D' ELSE '' END) as last_action
            FROM users u
            JOIN attendance a ON u.username = a.username
            ORDER BY a.date DESC LIMIT 20
        `);
        res.json(activity.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// Add Student to User Management
app.post('/api/users', async (req, res) => {
    const { username, name, room_no, plan_type } = req.body;
    try {
        await pool.query(
            'INSERT INTO users (username, name, room_no, plan_type) VALUES ($1, $2, $3, $4)',
            [username, name, room_no, plan_type]
        );
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Submit Complaint
app.post('/api/submit-issue', async (req, res) => {
    const { username, type, category, subject, message, date } = req.body;
    try {
        await pool.query(
            'INSERT INTO issues (username, type, category, subject, message, date) VALUES ($1, $2, $3, $4, $5, $6)',
            [username, type, category, subject, message, date]
        );
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// Initialize Inventory Table
async function initInventory() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
            id SERIAL PRIMARY KEY,
            item_name TEXT UNIQUE,
            quantity INTEGER DEFAULT 0,
            unit TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}
initInventory();

// Get All Inventory Items
app.get('/api/inventory', async (req, res) => {
    try {
        const items = await pool.query('SELECT * FROM inventory ORDER BY item_name ASC');
        res.json(items.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update or Add Inventory Item
app.post('/api/inventory/update', async (req, res) => {
    const { item_name, quantity, unit } = req.body;
    try {
        // This SQL "upserts" - it updates the item if it exists, otherwise inserts it
        await pool.query(`
            INSERT INTO inventory (item_name, quantity, unit) 
            VALUES ($1, $2, $3)
            ON CONFLICT (item_name) 
            DO UPDATE SET quantity = $2, unit = $3, last_updated = CURRENT_TIMESTAMP
        `, [item_name, quantity, unit]);
        res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// Student-Specific Dashboard Data
app.get('/api/student/dashboard/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const stats = await pool.query(`
            SELECT 
                SUM(breakfast) as b, 
                SUM(lunch) as l, 
                SUM(dinner) as d,
                COUNT(*) as total_days
            FROM attendance 
            WHERE username = $1`, [username]);

        const history = await pool.query(`
            SELECT date, breakfast, lunch, dinner 
            FROM attendance 
            WHERE username = $1 
            ORDER BY date DESC LIMIT 10`, [username]);

        res.json({
            stats: stats.rows[0],
            history: history.rows
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));