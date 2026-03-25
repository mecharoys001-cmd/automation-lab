-- Migration: admin_programs junction table
-- Links admins to the programs they are authorized to access.
-- Master admins bypass this check (they can access all programs).
-- Standard/editor admins must have an explicit grant in this table.

CREATE TABLE IF NOT EXISTS admin_programs (
  admin_id   uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, program_id)
);

COMMENT ON TABLE admin_programs IS 'Junction table: which admins can access which programs';

CREATE INDEX IF NOT EXISTS idx_admin_programs_admin ON admin_programs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_programs_program ON admin_programs (program_id);

-- Backfill: grant all existing admins access to all existing programs
-- so the migration is non-breaking.
INSERT INTO admin_programs (admin_id, program_id)
SELECT a.id, p.id
FROM admins a CROSS JOIN programs p
ON CONFLICT DO NOTHING;
