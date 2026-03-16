-- Migration: Program-scoped data
-- Adds program_id to instructors, venues, and tags tables
-- Backfills existing data with the first program found

-- 1. Add program_id columns (nullable initially)
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS program_id UUID;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS program_id UUID;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS program_id UUID;

-- 2. Backfill existing rows with the first (oldest) program
DO $$
DECLARE
  v_program_id UUID;
BEGIN
  SELECT id INTO v_program_id
  FROM programs
  ORDER BY start_date ASC
  LIMIT 1;

  IF v_program_id IS NOT NULL THEN
    UPDATE instructors SET program_id = v_program_id WHERE program_id IS NULL;
    UPDATE venues SET program_id = v_program_id WHERE program_id IS NULL;
    UPDATE tags SET program_id = v_program_id WHERE program_id IS NULL;
  END IF;
END $$;

-- 3. Make program_id NOT NULL
ALTER TABLE instructors ALTER COLUMN program_id SET NOT NULL;
ALTER TABLE venues ALTER COLUMN program_id SET NOT NULL;
ALTER TABLE tags ALTER COLUMN program_id SET NOT NULL;

-- 4. Add foreign key constraints
ALTER TABLE instructors
  ADD CONSTRAINT fk_instructors_program
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

ALTER TABLE venues
  ADD CONSTRAINT fk_venues_program
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT fk_tags_program
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

-- 5. Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_instructors_program_id ON instructors(program_id);
CREATE INDEX IF NOT EXISTS idx_venues_program_id ON venues(program_id);
CREATE INDEX IF NOT EXISTS idx_tags_program_id ON tags(program_id);

-- 6. Drop the unique constraint on tags(name) and replace with (name, program_id)
-- so different programs can have tags with the same name
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_category_key;
ALTER TABLE tags ADD CONSTRAINT tags_name_program_id_key UNIQUE (name, program_id);
