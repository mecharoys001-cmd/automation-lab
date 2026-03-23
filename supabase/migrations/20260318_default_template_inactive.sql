-- Change default status for new templates from Active to Inactive
-- so incomplete templates aren't misleadingly shown as Active.
ALTER TABLE session_templates
  ALTER COLUMN is_active SET DEFAULT false;
