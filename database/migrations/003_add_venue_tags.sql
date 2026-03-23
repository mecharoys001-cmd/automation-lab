-- Migration: Add venue tags support
-- Run this in Supabase SQL Editor

-- Create venue_tags junction table (many-to-many between venues and tags)
CREATE TABLE IF NOT EXISTS venue_tags (
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, tag_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster venue queries
CREATE INDEX IF NOT EXISTS idx_venue_tags_venue_id ON venue_tags(venue_id);

-- Create index for faster tag queries
CREATE INDEX IF NOT EXISTS idx_venue_tags_tag_id ON venue_tags(tag_id);

-- No data migration needed - venues will start with no tags
-- Admins can add tags through the UI
