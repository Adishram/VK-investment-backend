console.log('Starting server.js...');
const express = require('express');
require('dotenv').config();
const { Pool } = require('pg');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5001;

console.log('Port configured:', PORT);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

console.log('Connecting to database...');
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
    } else {
        console.log('Connected to Database');
        release();
        runMigrations();
    }
});

const runMigrations = async () => {
    try {
        console.log('Running migrations...');
        
        // pg_owners table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pg_owners (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                city VARCHAR(100) NOT NULL,
                address TEXT NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Add columns to pg_owners if not exist
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pg_owners' AND column_name = 'dob') THEN 
                    ALTER TABLE pg_owners ADD COLUMN dob VARCHAR(20); 
                END IF; 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pg_owners' AND column_name = 'profile_picture') THEN 
                    ALTER TABLE pg_owners ADD COLUMN profile_picture TEXT; 
                END IF; 
            END $$;
        `);
        
        // Add owner_email to pg_listings
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pg_listings' AND column_name = 'owner_email') THEN 
                    ALTER TABLE pg_listings ADD COLUMN owner_email VARCHAR(255); 
                END IF; 
            END $$;
        `);
        


        // customers table (NEWLY ADDED)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                mobile VARCHAR(20),
                pg_id INTEGER REFERENCES pg_listings(id),
                room_no VARCHAR(50),
                room_type VARCHAR(50),
                floor VARCHAR(50),
                move_in_date DATE,
                status VARCHAR(50) DEFAULT 'Due',
                booking_id VARCHAR(100),
                amount DECIMAL(10, 2),
                paid_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // announcements table (NEWLY ADDED)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                pg_id INTEGER REFERENCES pg_listings(id),
                owner_id INTEGER REFERENCES pg_owners(id),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // users table (for app users)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Fix announcements owner_id type for Clerk integration
        await pool.query(`
            DO $$ 
            BEGIN 
                -- Drop foreign key if exists (we need to find the constraint name dynamically or assume default)
                -- Usually it is announcements_owner_id_fkey
                IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'announcements_owner_id_fkey') THEN
                    ALTER TABLE announcements DROP CONSTRAINT announcements_owner_id_fkey;
                END IF;

                -- Change column type to VARCHAR
                ALTER TABLE announcements ALTER COLUMN owner_id TYPE VARCHAR(255);
            END $$;
        `);
        
        console.log('Migrations completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
};

// Keep Alive Cron
cron.schedule('*/4 * * * *', async () => {
    try {
        await pool.query('SELECT 1');
    } catch (error) {
        console.error('Error executing keep-alive query:', error);
    }
});

// --- Email Service Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to, subject, text) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('Email credentials not found. Skipping email.');
        console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}, Body: ${text}`);
        return;
    }
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

// --- Helper Functions ---
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// --- API Routes ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Super Admin Login
app.post('/api/super-admin/login', (req, res) => {
    const { email, password } = req.body;
    const ADMIN_EMAIL = 'admin@bmpg';
    const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecretAdmin2024!'; 

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Add PG Owner (with Email)
app.post('/api/super-admin/add-owner', async (req, res) => {
    const { name, email, mobile, city, address } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and Email are required' });
    }

    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let randomPassword = '';
        for (let i = 0; i < 12; i++) {
            randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const passwordHash = hashPassword(randomPassword);

        const query = `
            INSERT INTO pg_owners (name, email, mobile, city, address, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, email
        `;
        const values = [name, email, mobile, city, address, passwordHash];

        const result = await pool.query(query, values);
        
        // Send Email
        const emailBody = `Hello ${name},\n\nYour account has been created on Book My PG.\n\nLogin Credentials:\nEmail: ${email}\nPassword: ${randomPassword}\n\nPlease login and change your password immediately.\n\nRegards,\nTeam Book My PG`;
        await sendEmail(email, 'Welcome to Book My PG - Your Credentials', emailBody);

        res.status(201).json({
            owner: result.rows[0],
            generatedPassword: randomPassword,
            message: 'Owner added successfully. Email sent.'
        });

    } catch (error) {
        console.error('Error adding owner:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get All Owners (Super Admin)
app.get('/api/super-admin/owners', async (req, res) => {
    const { search } = req.query;
    try {
        let query = 'SELECT id, name, email, mobile, city FROM pg_owners';
        let values = [];
        
        if (search) {
            query += ' WHERE name ILIKE $1 OR email ILIKE $1 OR city ILIKE $1';
            values.push(`%${search}%`);
            paramCount++;
        }
        
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching owners:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete Owner (Super Admin)
app.delete('/api/super-admin/owner/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if owner exists
        const checkResult = await pool.query('SELECT id FROM pg_owners WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Owner not found' });
        }
        
        // Delete the owner
        await pool.query('DELETE FROM pg_owners WHERE id = $1', [id]);
        res.json({ success: true, message: 'Owner deleted successfully' });
    } catch (error) {
        console.error('Error deleting owner:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Owner Details (Super Admin)
app.get('/api/super-admin/owner/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const ownerResult = await pool.query('SELECT * FROM pg_owners WHERE id = $1', [id]);
        if (ownerResult.rows.length === 0) return res.status(404).json({ error: 'Owner not found' });

        const pgsResult = await pool.query('SELECT * FROM pg_listings WHERE owner_id = $1', [id]);
        
        // Get total customers for this owner's PGs
        const pgIds = pgsResult.rows.map(pg => pg.id);
        let customerCount = 0;
        if (pgIds.length > 0) {
            const customerResult = await pool.query('SELECT COUNT(*) FROM customers WHERE pg_id = ANY($1::int[])', [pgIds]);
            customerCount = parseInt(customerResult.rows[0].count);
        }

        res.json({
            owner: ownerResult.rows[0],
            pgs: pgsResult.rows,
            stats: {
                totalPGs: pgsResult.rows.length,
                totalCustomers: customerCount
            }
        });
    } catch (error) {
        console.error('Error fetching owner details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Availability (Super Admin)
app.get('/api/super-admin/availability', async (req, res) => {
    const { city, locality, search } = req.query;

    try {
        let query = `
            SELECT p.id, p.title, p.price, p.city, p.street as locality, p.food_included, p.occupancy_types,
                   COALESCE(o.name, 'Unknown') as owner_name, p.owner_email, p.address
            FROM pg_listings p
            LEFT JOIN pg_owners o ON p.owner_id = CAST(o.id AS VARCHAR)
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (city) {
            query += ` AND p.city ILIKE $${paramCount}`;
            values.push(`%${city}%`);
            paramCount++;
        }

        if (locality) {
            query += ` AND p.street ILIKE $${paramCount}`;
            values.push(`%${locality}%`);
            paramCount++;
        }

        if (search) {
            query += ` AND (p.title ILIKE $${paramCount} OR o.name ILIKE $${paramCount} OR p.address ILIKE $${paramCount})`;
            values.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY p.created_at DESC';

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Booking Report (Super Admin)
app.get('/api/super-admin/bookings', async (req, res) => {
    const { pgName, roomType } = req.query;
    try {
        let query = `
            SELECT c.id, p.title as "pgName", c.room_no as "roomNo", c.name as "customerName", 
                   c.move_in_date as "moveIn", c.booking_id as "bookingId", c.amount, 
                   c.paid_date as "paidDate", c.status
            FROM customers c
            JOIN pg_listings p ON c.pg_id = p.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (pgName) {
            query += ` AND p.title ILIKE $${paramCount}`;
            values.push(`%${pgName}%`);
            paramCount++;
        }

        if (roomType) {
            query += ` AND c.room_type ILIKE $${paramCount}`;
            values.push(`%${roomType}%`);
            paramCount++;
        }

        query += ' ORDER BY c.created_at DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Notify Payment (Super Admin)
app.post('/api/super-admin/notify-payment', async (req, res) => {
    try {
        const dueCustomers = await pool.query("SELECT * FROM customers WHERE status = 'Due'");
        
        for (const customer of dueCustomers.rows) {
            if (customer.email) {
                const emailBody = `Dear ${customer.name},\n\nThis is a reminder to pay your PG rent for this month.\n\nAmount: ${customer.amount}\n\nRegards,\nBook My PG`;
                await sendEmail(customer.email, 'Rent Payment Reminder', emailBody);
            }
        }
        
        res.json({ message: `Sent reminders to ${dueCustomers.rows.length} customers.` });
    } catch (error) {
        console.error('Error sending notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Owner Routes ---

// Login
app.post('/api/owner/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Required fields missing' });

    try {
        const result = await pool.query('SELECT * FROM pg_owners WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const owner = result.rows[0];
        const inputHash = hashPassword(password);

        if (inputHash === owner.password_hash) {
            res.json({ success: true, owner: { id: owner.id, name: owner.name, email: owner.email } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Owner Profile
app.get('/api/owner/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT id, name, email, mobile, city, address, dob, profile_picture FROM pg_owners WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Owner not found' });
        
        const owner = result.rows[0];
        const nameParts = owner.name.split(' ');
        res.json({
            id: owner.id,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' '),
            email: owner.email,
            mobile: owner.mobile,
            city: owner.city,
            address: owner.address,
            dob: owner.dob,
            profilePicture: owner.profile_picture
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update Owner Profile
app.put('/api/owner/:id', async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, mobile, dob } = req.body;
    try {
        const fullName = `${firstName} ${lastName}`.trim();
        const result = await pool.query('UPDATE pg_owners SET name = $1, mobile = $2, dob = $3 WHERE id = $4 RETURNING *', [fullName, mobile, dob, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Owner not found' });
        res.json({ message: 'Updated', owner: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Upload Image
app.post('/api/owner/:id/image', async (req, res) => {
    const { id } = req.params;
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });
    try {
        const result = await pool.query('UPDATE pg_owners SET profile_picture = $1 WHERE id = $2 RETURNING profile_picture', [image, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Owner not found' });
        res.json({ message: 'Uploaded', profilePicture: result.rows[0].profile_picture });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Change Password
app.post('/api/owner/change-password', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) return res.status(400).json({ error: 'All fields required' });
    try {
        const result = await pool.query('SELECT * FROM pg_owners WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Owner not found' });
        
        const owner = result.rows[0];
        if (hashPassword(currentPassword) !== owner.password_hash) return res.status(401).json({ error: 'Incorrect password' });
        
        await pool.query('UPDATE pg_owners SET password_hash = $1 WHERE email = $2', [hashPassword(newPassword), email]);
        res.json({ message: 'Password updated' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Owner Guests
app.get('/api/owner/:id/guests', async (req, res) => {
    const { id } = req.params; // Owner ID
    try {
        // Get all PGs for this owner
        const pgs = await pool.query('SELECT id, title FROM pg_listings WHERE owner_id = $1', [id]);
        const pgIds = pgs.rows.map(pg => pg.id);
        
        if (pgIds.length === 0) return res.json([]);

        // Get customers in these PGs
        const result = await pool.query(`
            SELECT c.*, p.title as pg_title 
            FROM customers c
            JOIN pg_listings p ON c.pg_id = p.id
            WHERE c.pg_id = ANY($1::int[])
            ORDER BY c.created_at DESC
        `, [pgIds]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching guests:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update Guest Details
app.put('/api/owner/guest/:id', async (req, res) => {
    const { id } = req.params;
    const { room_no, floor } = req.body;
    try {
        const result = await pool.query(
            'UPDATE customers SET room_no = $1, floor = $2 WHERE id = $3 RETURNING *',
            [room_no, floor, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Guest not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating guest:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// --- Common Routes ---

// Geocoding
app.get('/api/geocode', async (req, res) => {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'Address required' });
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1 },
            headers: { 'User-Agent': 'VK-Investment-App' }
        });
        if (response.data.length > 0) {
            const { lat, lon, display_name } = response.data[0];
            res.json({ lat, lon, display_name });
        } else {
            res.status(404).json({ error: 'Address not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Geocoding failed' });
    }
});

// Get PGs
app.get('/api/pg', async (req, res) => {
    const { owner_id } = req.query;
    try {
        let query = 'SELECT * FROM pg_listings';
        let values = [];
        if (owner_id) {
            query += ' WHERE owner_id = $1';
            values.push(owner_id);
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Add PG
app.post('/api/pg', async (req, res) => {
    const { 
        title, description, price, location, latitude, longitude, image_url, owner_contact,
        house_no, street, city, pincode,
        occupancy_types, occupancy_prices, food_included, notice_period, gate_close_time, safety_deposit,
        amenities, rules, rooms, images, owner_id, owner_email
    } = req.body;

    try {
        const query = `
      INSERT INTO pg_listings (
        title, description, price, location, latitude, longitude, image_url, owner_contact,
        house_no, street, city, pincode,
        occupancy_types, occupancy_prices, food_included, notice_period, gate_close_time, safety_deposit,
        amenities, rules, rooms, images, owner_id, owner_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *;
    `;
        const values = [
            title, description, price, location, latitude, longitude, image_url, owner_contact,
            house_no, street, city, pincode,
            JSON.stringify(occupancy_types || []),
            JSON.stringify(occupancy_prices || {}),
            food_included || false,
            notice_period || '30 days',
            gate_close_time || '10:30 PM',
            safety_deposit || '',
            JSON.stringify(amenities || []),
            JSON.stringify(rules || []),
            JSON.stringify(rooms || []),
            JSON.stringify(images || []),
            owner_id || null,
            owner_email || null
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding PG:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Review Routes
app.post('/api/pg/:id/review', async (req, res) => {
    const { id } = req.params;
    const { user_name, rating, review_text, review_images } = req.body;
    if (!user_name || !rating) return res.status(400).json({ error: 'Name/Rating required' });
    try {
        const pgCheck = await pool.query('SELECT id FROM pg_listings WHERE id = $1', [id]);
        if (pgCheck.rows.length === 0) return res.status(404).json({ error: 'PG not found' });

        const reviewResult = await pool.query(
            `INSERT INTO pg_reviews (pg_id, user_name, rating, review_text, review_images)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, user_name, rating, review_text || '', JSON.stringify(review_images || [])]
        );

        const avgResult = await pool.query('SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM pg_reviews WHERE pg_id = $1', [id]);
        const { avg_rating, review_count } = avgResult.rows[0];
        await pool.query('UPDATE pg_listings SET rating = $1, rating_count = $2 WHERE id = $3', [parseFloat(avg_rating).toFixed(2), review_count, id]);

        res.status(201).json(reviewResult.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/pg/:id/reviews', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM pg_reviews WHERE pg_id = $1 ORDER BY created_at DESC', [id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Groq Chat
app.post('/api/chat', async (req, res) => {
    const { message, history, context } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return res.status(500).json({ role: 'assistant', content: "Server error: API Key missing." });

    let systemPrompt = "You are a helpful assistant for 'Book My PGs'. When asked about PGs, do NOT list them in your text response, as they will be displayed visually to the user. Just provide a brief summary or answer specific questions about them.";
    if (context && context.pgs) {
        systemPrompt += `\n\nAvailable PGs (for your knowledge only, do not list them):\n${context.pgs.map(pg => `- ${pg.name}: ₹${pg.price}/mo, Location: ${pg.location}`).join('\n')}`;
    }

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "system", content: systemPrompt }, ...(history || []), { role: 'user', content: message }],
            temperature: 0.7,
            max_tokens: 1024
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        res.json(response.data.choices[0].message);
    } catch (error) {
        res.json({ role: 'assistant', content: "I'm having trouble connecting right now." });
    }
});


  // --- Announcements & My PG APIs ---

// Create Announcement (Owner)
app.post('/api/owner/announcement', async (req, res) => {
    const { pgId, ownerId, message } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO announcements (pg_id, owner_id, message) VALUES ($1, $2, $3) RETURNING *',
            [pgId, ownerId, message]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Announcements for a PG
app.get('/api/pg/:id/announcements', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM announcements WHERE pg_id = $1 ORDER BY created_at DESC',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get My PG Details (User)
app.get('/api/user/:email/my-pg', async (req, res) => {
    const { email } = req.params;
    try {
        // Find the latest active booking for this user
        const customerRes = await pool.query(
            `SELECT * FROM customers WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (customerRes.rows.length === 0) {
            return res.json({ hasPG: false });
        }

        const customer = customerRes.rows[0];
        const pgRes = await pool.query('SELECT * FROM pg_listings WHERE id = $1', [customer.pg_id]);
        
        if (pgRes.rows.length === 0) {
            return res.json({ hasPG: false }); // Should not happen if integrity is maintained
        }

        res.json({
            hasPG: true,
            pg: pgRes.rows[0],
            customer: customer
        });
    } catch (error) {
        console.error('Error fetching My PG:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Confirm Payment & Add Customer (Temporary)
app.post('/api/payment/confirm', async (req, res) => {
    const { name, email, mobile, pgId, roomType, amount, bookingId } = req.body;
    try {
        console.log('Received payment confirmation request:', { name, email, mobile, pgId, roomType, amount, bookingId });
        const result = await pool.query(
            `INSERT INTO customers (name, email, mobile, pg_id, room_type, amount, booking_id, status, paid_date, move_in_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Paid', NOW(), NOW()) RETURNING *`,
            [name, email, mobile, pgId, roomType, amount, bookingId]
        );
        console.log('Customer added successfully:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- User Profile Routes ---
app.post('/api/user/profile', async (req, res) => {
    const { email, phone } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        // Check if user exists
        const check = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (check.rows.length > 0) {
            // Update
            const result = await pool.query(
                'UPDATE users SET phone = $1, updated_at = NOW() WHERE email = $2 RETURNING *',
                [phone, email]
            );
            return res.json(result.rows[0]);
        } else {
            // Insert
            const result = await pool.query(
                'INSERT INTO users (email, phone) VALUES ($1, $2) RETURNING *',
                [email, phone]
            );
            return res.status(201).json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/user/profile/:email', async (req, res) => {
    const { email } = req.body; // Note: usually params, but let's support params too
    const targetEmail = req.params.email;
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [targetEmail]);
        if (result.rows.length === 0) {
            return res.json({ email: targetEmail, phone: null }); // Return empty profile if new
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    runMigrations();
});
