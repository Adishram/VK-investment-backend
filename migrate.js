const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // Add amenities column
        await pool.query(`
            ALTER TABLE pg_listings 
            ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('Added amenities column');

        // Add rules column
        await pool.query(`
            ALTER TABLE pg_listings 
            ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('Added rules column');

        // Add rooms column
        await pool.query(`
            ALTER TABLE pg_listings 
            ADD COLUMN IF NOT EXISTS rooms JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('Added rooms column');

        // Add images column (for multiple images)
        await pool.query(`
            ALTER TABLE pg_listings 
            ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('Added images column');

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
