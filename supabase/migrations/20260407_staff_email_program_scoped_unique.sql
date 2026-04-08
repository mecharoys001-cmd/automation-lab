-- Migration: Replace stale global email uniqueness with program-scoped constraint
--
-- Problem: A global UNIQUE constraint on staff.email ("instructors_email_key")
-- exists in production (likely created manually or by an early tool migration).
-- This prevents program duplication because the same instructor email cannot
-- appear in two different programs.
--
-- Fix: Drop the global constraint and add UNIQUE(program_id, email) so the
-- same email can exist across programs but remains unique within one program.

-- 1. Drop the stale global unique constraint (may be named for either the old
--    or new table name depending on when it was created).
ALTER TABLE staff DROP CONSTRAINT IF EXISTS instructors_email_key;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_email_key;

-- 2. Add program-scoped uniqueness: same email allowed across programs,
--    unique within a single program.  NULLs are not considered equal by
--    Postgres UNIQUE, so multiple NULL emails per program are fine.
ALTER TABLE staff
  ADD CONSTRAINT staff_program_id_email_key UNIQUE (program_id, email);
