-- Migration: Add Enhanced PG Fields
-- Run this migration to add new columns for occupancy, amenities, and ratings

-- Add new columns to pg_listings table
ALTER TABLE pg_listings 
ADD COLUMN IF NOT EXISTS occupancy_types JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS occupancy_prices JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS food_included BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notice_period VARCHAR(100) DEFAULT '30 days',
ADD COLUMN IF NOT EXISTS gate_close_time VARCHAR(50) DEFAULT '10:30 PM',
ADD COLUMN IF NOT EXISTS safety_deposit VARCHAR(50),
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS house_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS street VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);

-- Add check constraint to ensure rating is between 0 and 5
ALTER TABLE pg_listings 
ADD CONSTRAINT rating_range CHECK (rating >= 0 AND rating <= 5);

-- Create index on rating for faster filtering
CREATE INDEX IF NOT EXISTS idx_pg_listings_rating ON pg_listings(rating);

-- Create index on occupancy_types for faster filtering
CREATE INDEX IF NOT EXISTS idx_pg_listings_occupancy ON pg_listings USING GIN (occupancy_types);

-- Update schema.sql will be done separately to reflect new structure
