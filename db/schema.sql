CREATE TABLE IF NOT EXISTS pg_listings (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price VARCHAR(50),
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    image_url TEXT,
    owner_contact VARCHAR(100),
    occupancy_types JSONB DEFAULT '[]',
    occupancy_prices JSONB DEFAULT '{}',
    food_included BOOLEAN DEFAULT false,
    notice_period VARCHAR(100) DEFAULT '30 days',
    gate_close_time VARCHAR(50) DEFAULT '10:30 PM',
    safety_deposit VARCHAR(50),
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    rating_count INTEGER DEFAULT 0,
    house_no VARCHAR(100),
    street VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pg_listings_rating ON pg_listings(rating);
CREATE INDEX IF NOT EXISTS idx_pg_listings_occupancy ON pg_listings USING GIN (occupancy_types);
