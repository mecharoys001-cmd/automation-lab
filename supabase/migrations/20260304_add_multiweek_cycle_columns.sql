-- Add multi-week cycle support to session_templates
-- Allows templates to repeat on a 2-week, 3-week, or N-week cycle instead of just weekly

ALTER TABLE session_templates
  ADD COLUMN week_cycle_length integer,
  ADD COLUMN week_in_cycle integer;

COMMENT ON COLUMN session_templates.week_cycle_length IS 
  'Number of weeks in the repeat cycle. NULL or 1 = weekly (default). 2+ = multi-week cycle.';

COMMENT ON COLUMN session_templates.week_in_cycle IS 
  '0-indexed week number within the cycle (0 = Week 1, 1 = Week 2, etc.). Used when week_cycle_length > 1.';
