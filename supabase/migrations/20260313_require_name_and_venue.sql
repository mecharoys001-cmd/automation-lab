-- Make name and venue_id mandatory on session_templates and sessions.
-- Backfill any existing NULLs before adding the constraint.

-- 1. Backfill session_templates
UPDATE session_templates SET name = 'Untitled' WHERE name IS NULL;
UPDATE session_templates SET venue_id = (SELECT id FROM venues LIMIT 1) WHERE venue_id IS NULL;

-- 2. Backfill sessions
UPDATE sessions SET name = 'Untitled' WHERE name IS NULL;
UPDATE sessions SET venue_id = (SELECT id FROM venues LIMIT 1) WHERE venue_id IS NULL;

-- 3. Add NOT NULL constraints
ALTER TABLE session_templates ALTER COLUMN name SET NOT NULL;
ALTER TABLE session_templates ALTER COLUMN venue_id SET NOT NULL;

ALTER TABLE sessions ALTER COLUMN name SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN venue_id SET NOT NULL;
