-- Add venue_id column to template_placements so venue assignments persist across reloads

ALTER TABLE template_placements
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;

COMMENT ON COLUMN template_placements.venue_id IS
  'The venue this placement is assigned to. NULL means unassigned (falls back to the template default).';
