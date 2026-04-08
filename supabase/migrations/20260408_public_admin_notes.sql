-- Migration: Add public_notes and admin_notes to staff, venues, and session_templates
-- Run in Supabase SQL Editor

-- 1. Staff: rename notes → admin_notes, add public_notes
ALTER TABLE staff RENAME COLUMN notes TO admin_notes;
ALTER TABLE staff ADD COLUMN public_notes TEXT;

-- 2. Venues: rename notes → admin_notes, add public_notes
ALTER TABLE venues RENAME COLUMN notes TO admin_notes;
ALTER TABLE venues ADD COLUMN public_notes TEXT;

-- 3. Session Templates: add both new columns
ALTER TABLE session_templates ADD COLUMN public_notes TEXT;
ALTER TABLE session_templates ADD COLUMN admin_notes TEXT;
