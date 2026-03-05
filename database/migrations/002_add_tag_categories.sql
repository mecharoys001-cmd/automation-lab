-- Migration: Add category support to tags table
-- Run this in Supabase SQL Editor

-- Add category column to tags table
ALTER TABLE tags 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- Create index for faster category-based queries
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- Update existing tags to have a default category if they're null
UPDATE tags SET category = 'General' WHERE category IS NULL;

-- Optional: Add check constraint to prevent empty categories
ALTER TABLE tags 
ADD CONSTRAINT tags_category_not_empty CHECK (category IS NOT NULL AND trim(category) != '');

-- Suggested default categories (optional - uncomment to pre-populate)
-- UPDATE tags SET category = 'Instrument' WHERE name IN ('Percussion', 'Strings', 'Brass', 'Piano', 'Guitar', 'Woodwind', 'Choral');
-- UPDATE tags SET category = 'Event Type' WHERE name IN ('Field Trip', 'Showcase', 'Guest Artist', 'Performance');
-- UPDATE tags SET category = 'Administrative' WHERE name IN ('TA Check-In', 'Lead TAs Away');
