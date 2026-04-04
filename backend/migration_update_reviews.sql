-- ===================================================
-- Migration: Update reviews table to allow empty comments
-- Run this in your Supabase SQL editor
-- Date: 2026-03-25
-- ===================================================

-- Alter the reviews table to make comment have a default value
ALTER TABLE reviews
ALTER COLUMN comment SET DEFAULT '';

-- Update any existing NULL comments to empty string (if any exist)
UPDATE reviews
SET comment = ''
WHERE comment IS NULL;

-- Optionally, you can also make the column nullable if you prefer
-- ALTER TABLE reviews
-- ALTER COLUMN comment DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'reviews' AND column_name = 'comment';
