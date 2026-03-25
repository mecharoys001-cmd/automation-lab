-- Tool configuration: one row per tracked tool
CREATE TABLE IF NOT EXISTS tool_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id TEXT UNIQUE NOT NULL,           -- e.g. 'csv-dedup', 'reports', 'scheduler'
  display_name TEXT NOT NULL,             -- e.g. 'CSV Deduplicator'
  minutes_per_use NUMERIC(10,2) NOT NULL DEFAULT 0,
  tracking_method TEXT NOT NULL DEFAULT 'per_use',  -- 'per_use', 'per_csv_upload', 'per_schedule_run'
  description TEXT,                       -- admin-facing note about what counts as "one use"
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage events: one row per tracked action
CREATE TABLE IF NOT EXISTS tool_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_config(tool_id),
  content_hash TEXT,                      -- SHA-256 of CSV content (for dedup)
  user_email TEXT,                        -- NULL for now, populated in Phase 2
  org_id UUID,                            -- NULL for now, populated in Phase 2
  metadata JSONB DEFAULT '{}',            -- flexible: { sessions_generated: 42, file_rows: 500, etc. }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_tool_usage_tool_id ON tool_usage(tool_id);
CREATE INDEX idx_tool_usage_created_at ON tool_usage(created_at);
CREATE INDEX idx_tool_usage_content_hash ON tool_usage(tool_id, content_hash);

-- Seed initial tool config
INSERT INTO tool_config (tool_id, display_name, minutes_per_use, tracking_method, description) VALUES
  ('csv-dedup', 'CSV Deduplicator', 60, 'per_csv_upload', 'Time to manually find and remove duplicates from a mailing list. Tracked per unique CSV upload (content-hashed).'),
  ('reports', 'Transaction Reports', 30, 'per_csv_upload', 'Time to manually compile Shopify transaction summaries. Tracked per unique CSV upload (content-hashed).'),
  ('scheduler', 'Symphonix Scheduler', 480, 'per_schedule_run', 'Time to manually create a program calendar/schedule. Tracked per schedule generation run. Metadata stores session count.')
ON CONFLICT (tool_id) DO NOTHING;
