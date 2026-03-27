-- Add historical_runs_seeded flag to prevent duplicate backfills
ALTER TABLE tool_config
  ADD COLUMN IF NOT EXISTS historical_runs_seeded BOOLEAN DEFAULT FALSE;
