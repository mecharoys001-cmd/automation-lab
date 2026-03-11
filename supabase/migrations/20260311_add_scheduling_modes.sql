-- Add scheduling mode columns to session_templates
-- Supports: date_range, duration, session_count, ongoing (default)

ALTER TABLE session_templates
  ADD COLUMN IF NOT EXISTS scheduling_mode text DEFAULT 'ongoing'
    CHECK (scheduling_mode IN ('date_range', 'duration', 'session_count', 'ongoing')),
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS duration_weeks integer,
  ADD COLUMN IF NOT EXISTS session_count integer,
  ADD COLUMN IF NOT EXISTS within_weeks integer;
