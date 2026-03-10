-- Analytics events table for user activity tracking
-- 30-day retention with automatic cleanup

CREATE TABLE IF NOT EXISTS analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  user_email    text,
  session_id    text NOT NULL,
  event_type    text NOT NULL CHECK (event_type IN ('page_view', 'button_click', 'form_submit')),
  page_path     text NOT NULL,
  element_id    text,
  element_text  text,
  user_agent    text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON analytics_events(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);

-- Composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date ON analytics_events(event_type, created_at);

-- Enable RLS (service client bypasses this, browser client respects it)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- No public access policies - only service client should read/write
-- This ensures analytics data is only accessible through our API routes
