# VK Investments - Backend API Server

<p align="center">
  <strong>RESTful API Backend for VK Investments PG Accommodation Platform</strong>
</p>

<p align="center">
  Node.js + Express.js | PostgreSQL | JWT-less Auth | Razorpay | AI Chat
</p>

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Technology Stack](#-technology-stack)
3. [Architecture](#-architecture)
4. [Quick Start](#-quick-start)
5. [Environment Variables](#-environment-variables)
6. [Database Schema](#-database-schema)
7. [API Reference](#-api-reference)
   - [PG Listings](#pg-listings)
   - [Owner APIs](#owner-apis)
   - [Admin APIs](#admin-apis)
   - [Visit Management](#visit-management)
   - [Payment APIs](#payment-apis)
   - [Reviews](#reviews)
   - [Announcements](#announcements)
   - [Utility APIs](#utility-apis)
8. [Authentication](#-authentication)
9. [Error Handling](#-error-handling)
10. [Database Migrations](#-database-migrations)
11. [Email Service](#-email-service)
12. [AI Chat Integration](#-ai-chat-integration)
13. [Deployment](#-deployment)
14. [Security Considerations](#-security-considerations)

---

## 🎯 Overview

This backend server powers the VK Investments mobile application, providing APIs for:

- **PG Listings Management** - CRUD operations for PG accommodations
- **User Authentication** - Owner and Admin login with bcrypt hashing
- **Customer Management** - Track bookings and room assignments
- **Visit Scheduling** - Handle visit requests from users
- **Payment Processing** - Razorpay integration for bookings
- **AI Chatbot** - Groq-powered assistance
- **Owner Dashboard** - Statistics, payments, and announcements

### Key Design Decisions

1. **Stateless Authentication** - No JWT; session managed on client via AsyncStorage
2. **Password Hashing** - bcrypt with salt rounds for security
3. **Auto-migrations** - Database schema updates run on server start
4. **JSON Storage** - Complex data (amenities, rooms, images) stored as JSONB
5. **Email Notifications** - Nodemailer for owner credentials delivery

---

## 🛠 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **Express.js** | 4.18.x | Web framework |
| **PostgreSQL** | 15+ | Relational database |
| **node-postgres (pg)** | 8.x | PostgreSQL client with connection pooling |
| **bcrypt** | 5.1.x | Password hashing |
| **nodemailer** | 6.9.x | Email sending (Gmail) |
| **axios** | 1.6.x | HTTP client for external APIs |
| **cors** | 2.8.x | Cross-Origin Resource Sharing |
| **Groq SDK** | Latest | AI chat integration |

---

## 🏗 Architecture

### Server Structure

```
backend/
├── server.js              # Main server file with all routes
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not in repo)
└── db/
    ├── schema.sql         # Base database schema
    └── migration_super_admin.sql  # Admin table migration
```

### Request Flow

```
Client Request
     │
     ▼
Express.js Router
     │
     ├── CORS Middleware (Allow all origins)
     ├── JSON Body Parser
     │
     ▼
Route Handler
     │
     ├── Input Validation
     ├── Database Query (pg Pool)
     ├── Business Logic
     │
     ▼
JSON Response
```

### Connection Pooling

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // For cloud databases
});
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/Adishram/VK-investment-backend.git
cd VK-investment-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Database

Create PostgreSQL database:

```sql
CREATE DATABASE vk_investments;
```

### 4. Configure Environment

Create `.env` file:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/vk_investments
PORT=3000
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
GROQ_API_KEY=your_groq_api_key
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret
```

### 5. Start Server

```bash
node server.js
```

Server runs at `http://localhost:3000`

### 6. Verify

```bash
curl http://localhost:3000/api/pg
```

---

## 🔐 Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `PORT` | ❌ | Server port (default: 3000) | `3000` |
| `EMAIL_USER` | ✅ | Gmail address for notifications | `noreply@vkinvestments.com` |
| `EMAIL_PASS` | ✅ | Gmail App Password | `xxxx xxxx xxxx xxxx` |
| `GROQ_API_KEY` | ❌ | Groq API for AI chat | `gsk_xxxxx` |
| `RAZORPAY_KEY_ID` | ✅ | Razorpay key ID | `rzp_test_xxxxx` |
| `RAZORPAY_KEY_SECRET` | ✅ | Razorpay secret | `xxxxx` |

### Gmail App Password Setup

1. Enable 2-Factor Authentication on Gmail
2. Go to Google Account → Security → App Passwords
3. Generate password for "Mail"
4. Use the 16-character password in `EMAIL_PASS`

---

## 🗄 Database Schema

### Tables

#### `pg_listings` - PG Accommodation Listings

```sql
CREATE TABLE pg_listings (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price VARCHAR(50),
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    image_url TEXT,
    images JSONB DEFAULT '[]',
    owner_contact VARCHAR(100),
    owner_id INTEGER,
    owner_email VARCHAR(255),
    gender VARCHAR(50) DEFAULT 'unisex',
    occupancy_types JSONB DEFAULT '[]',
    occupancy_prices JSONB DEFAULT '{}',
    rooms JSONB DEFAULT '[]',
    amenities JSONB DEFAULT '[]',
    rules JSONB DEFAULT '[]',
    food_included BOOLEAN DEFAULT false,
    notice_period VARCHAR(100) DEFAULT '30 days',
    gate_close_time VARCHAR(50) DEFAULT '10:30 PM',
    safety_deposit VARCHAR(50),
    rating DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    house_no VARCHAR(100),
    street VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**JSONB Field Examples:**

```json
// images
["https://example.com/img1.jpg", "data:image/jpeg;base64,..."]

// occupancy_types
["Single Room", "Double Sharing", "Triple Sharing"]

// occupancy_prices
{"Single Room": 8000, "Double Sharing": 5000, "Triple Sharing": 4000}

// rooms (detailed)
[
  {"type": "Single Room", "count": 5, "available": 3, "isAC": true, "price": 8000, "deposit": 16000},
  {"type": "Double Sharing", "count": 10, "available": 8, "isAC": false, "price": 5000, "deposit": 10000}
]

// amenities
["Wi-Fi", "AC", "Hot Water", "Laundry", "Parking"]

// rules
["No Smoking", "No Drinking", "Gate closes at 10:30 PM"]
```

#### `pg_owners` - PG Owner Accounts

```sql
CREATE TABLE pg_owners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    profile_picture TEXT,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `customers` - Booked Customers

```sql
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    mobile VARCHAR(20),
    pg_id INTEGER REFERENCES pg_listings(id),
    room_no VARCHAR(50),
    room_type VARCHAR(50),
    floor VARCHAR(50),
    move_in_date DATE,
    status VARCHAR(50) DEFAULT 'Due',  -- 'Paid' or 'Due'
    booking_id VARCHAR(100),
    amount DECIMAL(10, 2),
    paid_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `visit_requests` - Scheduled Visits

```sql
CREATE TABLE visit_requests (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    pg_id INTEGER REFERENCES pg_listings(id),
    owner_email VARCHAR(255),
    visit_date DATE NOT NULL,
    visit_time VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `pg_reviews` - User Reviews

```sql
CREATE TABLE pg_reviews (
    id SERIAL PRIMARY KEY,
    pg_id INTEGER REFERENCES pg_listings(id),
    user_name VARCHAR(255) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_images JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `announcements` - Owner Announcements

```sql
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    pg_id INTEGER REFERENCES pg_listings(id),
    owner_id VARCHAR(255),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `super_admins` - Platform Administrators

```sql
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📚 API Reference

### Base URL

```
http://localhost:3000/api
```

### Response Format

All responses follow this structure:

```json
// Success
{
  "id": 1,
  "title": "...",
  ...
}

// or Array
[
  { "id": 1, ... },
  { "id": 2, ... }
]

// Error
{
  "error": "Error message"
}
```

---

### PG Listings

#### Get All PGs

```http
GET /api/pg
GET /api/pg?owner_id=1
```

**Query Parameters:**
- `owner_id` (optional) - Filter by owner

**Response:**
```json
[
  {
    "id": 1,
    "title": "Sunrise PGs for Men",
    "description": "Comfortable PG near IT park...",
    "price": "5000",
    "city": "Bangalore",
    "gender": "men",
    "rating": 4.5,
    "images": ["https://..."],
    "amenities": ["Wi-Fi", "AC"],
    ...
  }
]
```

#### Get Single PG

```http
GET /api/pg/:id
```

**Response:** Single PG object with all fields

#### Create PG

```http
POST /api/pg
Content-Type: application/json

{
  "title": "New PG for Women",
  "description": "Modern facilities...",
  "price": 6000,
  "location": "Koramangala",
  "city": "Bangalore",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "gender": "women",
  "owner_id": 1,
  "owner_email": "owner@example.com",
  "owner_contact": "9876543210",
  "food_included": true,
  "notice_period": "30 days",
  "gate_close_time": "10:30 PM",
  "safety_deposit": "10000",
  "occupancy_types": ["Single Room", "Double Sharing"],
  "occupancy_prices": {"Single Room": 8000, "Double Sharing": 5000},
  "rooms": [
    {"type": "Single Room", "count": 5, "isAC": true, "price": 8000, "deposit": 16000}
  ],
  "amenities": ["Wi-Fi", "AC", "Hot Water"],
  "rules": ["No Smoking", "No Drinking"],
  "images": ["data:image/jpeg;base64,..."]
}
```

**Response:** Created PG object

#### Update PG

```http
PUT /api/pg/:id
Content-Type: application/json

{
  "price": 7000,
  "amenities": ["Wi-Fi", "AC", "Gym"]
}
```

#### Delete PG

```http
DELETE /api/pg/:id
```

---

### Owner APIs

#### Owner Login

```http
POST /api/owner/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "owner": {
    "id": 1,
    "name": "John Owner",
    "email": "owner@example.com",
    "mobile": "9876543210",
    "city": "Bangalore",
    "state": "Karnataka"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

#### Get Owner Statistics

```http
GET /api/owner/:id/stats
```

**Response:**
```json
{
  "totalPGs": 3,
  "totalCustomers": 25,
  "totalEarnings": 150000,
  "pendingPayments": 5,
  "paidPayments": 20
}
```

#### Get Owner's Guests

```http
GET /api/owner/:id/guests
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Rahul Kumar",
    "email": "rahul@example.com",
    "mobile": "9876543210",
    "pg_id": 1,
    "pg_title": "Sunrise PGs",
    "room_no": "101",
    "floor": "1st",
    "room_type": "Single Room",
    "move_in_date": "2024-01-15",
    "status": "Paid",
    "amount": 8000
  }
]
```

#### Get Owner's Visits

```http
GET /api/owner/:id/visits
```

**Response:**
```json
[
  {
    "id": 1,
    "user_name": "Priya",
    "user_email": "priya@example.com",
    "pg_id": 1,
    "pg_title": "Sunrise PGs",
    "visit_date": "2024-12-15",
    "visit_time": "2:00 PM",
    "status": "pending",
    "created_at": "2024-12-10T10:30:00Z"
  }
]
```

#### Get Owner's Payments

```http
GET /api/owner/:id/payments
```

**Response:**
```json
{
  "customers": [
    {
      "id": 1,
      "name": "Rahul",
      "pg_title": "Sunrise PGs",
      "amount": 8000,
      "status": "Paid",
      "room_type": "Single Room",
      "paid_date": "2024-12-01"
    }
  ],
  "totalEarnings": 150000,
  "paidCount": 20,
  "dueCount": 5
}
```

#### Change Owner Password

```http
PUT /api/owner/password
Content-Type: application/json

{
  "email": "owner@example.com",
  "currentPassword": "oldpassword",
  "newPassword": "newsecurepassword"
}
```

---

### Admin APIs

#### Admin Login

```http
POST /api/admin/login
Content-Type: application/json

{
  "email": "admin@vkinvestments.com",
  "password": "adminpassword"
}
```

#### Get All Owners

```http
GET /api/admin/owners
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Owner",
    "email": "john@example.com",
    "mobile": "9876543210",
    "city": "Bangalore",
    "pg_count": 3,
    "created_at": "2024-01-01"
  }
]
```

#### Add New Owner

```http
POST /api/admin/owners
Content-Type: application/json

{
  "name": "New Owner",
  "email": "newowner@example.com",
  "mobile": "9876543210",
  "city": "Chennai",
  "state": "Tamil Nadu"
}
```

**Response:**
```json
{
  "owner": {
    "id": 5,
    "name": "New Owner",
    "email": "newowner@example.com"
  },
  "generatedPassword": "Xy7$mK2p"
}
```

*Password is auto-generated and emailed to the owner.*

#### Delete Owner

```http
DELETE /api/admin/owners/:id
```

---

### Visit Management

#### Schedule Visit

```http
POST /api/visit
Content-Type: application/json

{
  "userEmail": "user@example.com",
  "userName": "User Name",
  "pgId": 1,
  "ownerEmail": "owner@example.com",
  "date": "2024-12-20",
  "time": "2:00 PM"
}
```

#### Approve Visit

```http
PUT /api/visit/:id/approve
```

#### Reject Visit

```http
PUT /api/visit/:id/reject
```

#### Get User's Visits

```http
GET /api/visit/user/:email
```

---

### Payment APIs

#### Create Razorpay Order

```http
POST /api/payment/create-order
Content-Type: application/json

{
  "amount": 8000,
  "currency": "INR",
  "receipt": "booking_123"
}
```

**Response:**
```json
{
  "id": "order_xxxxx",
  "amount": 800000,
  "currency": "INR"
}
```

#### Verify Payment

```http
POST /api/payment/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "xxxxx",
  "pgId": 1,
  "userId": 1,
  "roomType": "Single Room",
  "amount": 8000
}
```

---

### Reviews

#### Get PG Reviews

```http
GET /api/pg/:id/reviews
```

**Response:**
```json
[
  {
    "id": 1,
    "user_name": "Rahul",
    "rating": 4,
    "review_text": "Great place, clean rooms...",
    "review_images": ["https://..."],
    "created_at": "2024-12-01"
  }
]
```

#### Add Review

```http
POST /api/pg/:id/review
Content-Type: application/json

{
  "user_name": "Rahul Kumar",
  "rating": 4,
  "review_text": "Great facilities and friendly staff",
  "review_images": ["data:image/jpeg;base64,..."]
}
```

---

### Announcements

#### Get Announcements for PG

```http
GET /api/announcements/:pgId
```

**Response:**
```json
[
  {
    "id": 1,
    "message": "Water supply will be interrupted tomorrow 10 AM - 2 PM",
    "created_at": "2024-12-10T08:00:00Z"
  }
]
```

#### Create Announcement

```http
POST /api/announcements
Content-Type: application/json

{
  "pgId": 1,
  "ownerId": 1,
  "message": "Rent due date reminder: Please pay by 5th of this month"
}
```

---

### Utility APIs

#### Geocode Address

```http
GET /api/geocode?address=Koramangala,Bangalore
```

**Response:**
```json
{
  "lat": "12.9352",
  "lon": "77.6245",
  "display_name": "Koramangala, Bangalore, Karnataka, India"
}
```

#### Get My PG (User's Booking)

```http
GET /api/my-pg/:email
```

#### AI Chat

```http
POST /api/chat
Content-Type: application/json

{
  "message": "What amenities are typically included in PGs?",
  "context": []
}
```

**Response:**
```json
{
  "reply": "Common amenities in PGs include...",
  "context": [...]
}
```

---

## 🔒 Authentication

### Password Hashing

All passwords are hashed using bcrypt:

```javascript
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

// Hash password
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Verify password
const match = await bcrypt.compare(password, hash);
```

### Auto-Generated Passwords

When adding a new owner, the system generates a random 8-character password:

```javascript
function generatePassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (missing required fields) |
| 401 | Unauthorized (invalid credentials) |
| 404 | Not Found |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "Description of what went wrong"
}
```

---

## 🔄 Database Migrations

Migrations run automatically on server startup in `runMigrations()`:

```javascript
const runMigrations = async () => {
    // Create tables if not exist
    await pool.query(`CREATE TABLE IF NOT EXISTS pg_owners (...)`);
    
    // Add columns safely
    await pool.query(`
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'pg_listings' 
                           AND column_name = 'gender') THEN 
                ALTER TABLE pg_listings ADD COLUMN gender VARCHAR(50) DEFAULT 'unisex'; 
            END IF; 
        END $$;
    `);
};
```

---

## 📧 Email Service

### Configuration

Uses Gmail SMTP with Nodemailer:

```javascript
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
```

### Sending Owner Credentials

```javascript
await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: ownerEmail,
    subject: 'Welcome to VK Investments - Your Login Credentials',
    html: `
        <h2>Welcome ${name}!</h2>
        <p>Your PG Owner account has been created.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${generatedPassword}</p>
        <p>Please change your password after first login.</p>
    `
});
```

---

## 🤖 AI Chat Integration

### Groq Setup

```javascript
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
```

### Chat Endpoint

```javascript
app.post('/api/chat', async (req, res) => {
    const { message, context } = req.body;
    
    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: 'You are a helpful PG accommodation assistant...' },
            ...context,
            { role: 'user', content: message }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.7
    });
    
    res.json({
        reply: completion.choices[0].message.content,
        context: [...context, { role: 'user', content: message }, 
                            { role: 'assistant', content: completion.choices[0].message.content }]
    });
});
```

---

## 🚢 Deployment

### Environment Setup

1. **Render/Railway:**
   - Connect GitHub repository
   - Set environment variables
   - Deploy with `npm start`

2. **Heroku:**
   ```bash
   heroku create vk-investments-api
   heroku config:set DATABASE_URL=...
   git push heroku main
   ```

3. **Docker:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```

### Database

Use managed PostgreSQL:
- **Supabase** - Free tier available
- **Neon** - Serverless PostgreSQL
- **Railway** - Built-in PostgreSQL add-on

---

## 🔐 Security Considerations

### Current Implementation

- ✅ Passwords hashed with bcrypt (10 salt rounds)
- ✅ CORS enabled for mobile app access
- ✅ Input validation on required fields
- ✅ SQL injection prevention via parameterized queries

### Recommendations for Production

- [ ] Add rate limiting
- [ ] Implement JWT tokens for API authentication
- [ ] Add request validation middleware (joi/zod)
- [ ] Set up HTTPS
- [ ] Configure CORS for specific origins
- [ ] Add request logging (winston/morgan)
- [ ] Implement API versioning

---

## 📊 Performance

### Connection Pooling

PostgreSQL connection pool is configured for optimal performance:

```javascript
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,           // Maximum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});
```

### Indexes

```sql
CREATE INDEX idx_pg_listings_rating ON pg_listings(rating);
CREATE INDEX idx_pg_listings_city ON pg_listings(city);
CREATE INDEX idx_pg_listings_owner ON pg_listings(owner_id);
CREATE INDEX idx_customers_pg ON customers(pg_id);
CREATE INDEX idx_visits_status ON visit_requests(status);
```

---

## 👨‍💻 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit Pull Request

---

## 📄 License

Proprietary - All Rights Reserved

---

<p align="center">
  VK Investments Backend API - Powering PG Accommodations
</p>
