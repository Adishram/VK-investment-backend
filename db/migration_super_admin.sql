-- Create pg_owners table
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

-- Add owner_email to pg_listings if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pg_listings' AND column_name = 'owner_email') THEN 
        ALTER TABLE pg_listings ADD COLUMN owner_email VARCHAR(255); 
    END IF; 
END $$;
