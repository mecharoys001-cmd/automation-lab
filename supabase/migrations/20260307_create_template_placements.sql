-- Create template_placements table for Schedule Builder
-- Stores the visual placement of templates in the weekly grid

CREATE TABLE IF NOT EXISTS template_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
  day_index integer NOT NULL CHECK (day_index >= 0 AND day_index <= 6),
  start_hour numeric NOT NULL CHECK (start_hour >= 0 AND start_hour < 24),
  duration_hours numeric NOT NULL CHECK (duration_hours > 0),
  week_index integer DEFAULT 0,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_placements_program ON template_placements(program_id);
CREATE INDEX IF NOT EXISTS idx_template_placements_template ON template_placements(template_id);
CREATE INDEX IF NOT EXISTS idx_template_placements_venue ON template_placements(venue_id);

-- Comments
COMMENT ON TABLE template_placements IS 'Visual placements of templates in the Schedule Builder weekly grid';
COMMENT ON COLUMN template_placements.day_index IS '0=Monday, 1=Tuesday, etc.';
COMMENT ON COLUMN template_placements.start_hour IS 'Fractional hour (e.g., 9.5 = 9:30 AM)';
COMMENT ON COLUMN template_placements.venue_id IS 'Venue assignment for this placement (overrides template default)';
COMMENT ON COLUMN template_placements.week_index IS 'For multi-week schedules (0-indexed)';
