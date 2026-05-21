-- Register the Calendar Automator (nwct-calendar) in tool_config.
-- Restricted by default: only granted users / suite members can see it on /tools.
INSERT INTO tool_config (tool_id, display_name, minutes_per_use, tracking_method, description, is_active) VALUES
  ('nwct-calendar', 'Calendar Automator', 240, 'per_csv_upload', 'Time to manually lay out the NWCT Arts Council monthly print calendar from a CSV of events (column mapping, validation, grouping into Daily / Long Runs / Workshops, print-ready preview). Tracked per unique CSV upload (content-hashed).', TRUE)
ON CONFLICT (tool_id) DO NOTHING;

-- If the visibility column exists in this environment, mark the tool as restricted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tool_config' AND column_name = 'visibility'
  ) THEN
    EXECUTE $sql$
      UPDATE tool_config
      SET visibility = 'restricted'
      WHERE tool_id = 'nwct-calendar'
        AND (visibility IS NULL OR visibility <> 'restricted')
    $sql$;
  END IF;
END $$;
