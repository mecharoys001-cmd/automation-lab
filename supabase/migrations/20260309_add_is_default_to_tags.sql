-- Add is_default flag to tags table so default tags survive "Clear Everything"
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Index for fast filtering during clear-all
CREATE INDEX IF NOT EXISTS idx_tags_is_default ON tags (is_default) WHERE is_default = true;
