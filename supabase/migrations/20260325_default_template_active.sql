-- Revert: templates should default to active.
-- Users can deactivate individual templates via the toggle column.
ALTER TABLE session_templates
  ALTER COLUMN is_active SET DEFAULT true;

-- Also activate any existing inactive templates
UPDATE session_templates SET is_active = true WHERE is_active = false;
