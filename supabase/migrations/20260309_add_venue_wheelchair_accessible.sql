-- Add wheelchair accessibility flag to venues table
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS is_wheelchair_accessible BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN venues.is_wheelchair_accessible IS 'Indicates if this venue is wheelchair accessible';
