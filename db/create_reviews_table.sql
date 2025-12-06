CREATE TABLE IF NOT EXISTS pg_reviews (
    id SERIAL PRIMARY KEY,
    pg_id INTEGER NOT NULL REFERENCES pg_listings(id) ON DELETE CASCADE,
    user_name VARCHAR(100) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_images JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on pg_id for faster review lookups
CREATE INDEX IF NOT EXISTS idx_pg_reviews_pg_id ON pg_reviews(pg_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_pg_reviews_created_at ON pg_reviews(created_at DESC);
