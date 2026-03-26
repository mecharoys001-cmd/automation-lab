-- Add recurring usage tracking columns to tool_config
ALTER TABLE tool_config
  ADD COLUMN IF NOT EXISTS run_frequency TEXT,           -- 'daily', 'weekly', 'monthly', 'custom'
  ADD COLUMN IF NOT EXISTS run_interval_days INTEGER,    -- for custom: number of days between runs
  ADD COLUMN IF NOT EXISTS first_run_date DATE,
  ADD COLUMN IF NOT EXISTS historical_runs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_run_date DATE;
