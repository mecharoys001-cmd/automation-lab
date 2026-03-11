-- Sprint 3: Add name and additional_tags columns to session_templates
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS additional_tags text[];
