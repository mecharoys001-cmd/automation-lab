-- User preferences table: stores per-user, per-program UI preferences as JSONB.
-- Initial use case: calendar visible time range persistence.

CREATE TABLE IF NOT EXISTS user_preferences (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT        NOT NULL,
  program_id UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  key        TEXT        NOT NULL,
  value      JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_email, program_id, key)
);

-- Index for fast lookups by user + program
CREATE INDEX idx_user_preferences_lookup
  ON user_preferences (user_email, program_id);

-- Auto-update updated_at on modification
CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: enabled with service-role bypass (API routes use service client)
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON user_preferences FOR ALL
  USING (true)
  WITH CHECK (true);
