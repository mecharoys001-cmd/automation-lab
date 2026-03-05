-- Make template time fields nullable to support flexible templates
-- Templates with NULL times can be placed anywhere on the weekly grid
-- Templates with specific times are placed at those exact times

ALTER TABLE session_templates
  ALTER COLUMN start_time DROP NOT NULL,
  ALTER COLUMN end_time DROP NOT NULL,
  ALTER COLUMN duration_minutes DROP NOT NULL;

-- Add a comment explaining the design
COMMENT ON COLUMN session_templates.start_time IS 'Fixed start time for template (NULL = flexible placement)';
COMMENT ON COLUMN session_templates.end_time IS 'Fixed end time for template (NULL = flexible placement)';
COMMENT ON COLUMN session_templates.duration_minutes IS 'Session duration (NULL = infer from placement)';
