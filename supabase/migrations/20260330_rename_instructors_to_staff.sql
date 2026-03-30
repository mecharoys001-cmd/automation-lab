-- ============================================================================
-- Migration: Rename instructors → staff + Auto-grant tool access
-- ============================================================================
-- This migration:
-- 1. Renames the instructors table to staff
-- 2. Updates foreign key references in related tables
-- 3. Backfills tool_access for existing active staff
-- 4. Creates triggers to auto-grant/revoke tool access
-- ============================================================================

-- Step 1: Rename the table
ALTER TABLE instructors RENAME TO staff;

-- Step 2: Update foreign key column names in related tables
-- Check sessions table for instructor_id references
ALTER TABLE sessions RENAME COLUMN instructor_id TO staff_id;

-- Update the foreign key constraint name for clarity
ALTER TABLE sessions 
  DROP CONSTRAINT IF EXISTS sessions_instructor_id_fkey;
ALTER TABLE sessions 
  ADD CONSTRAINT sessions_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- Step 3: Backfill tool_access for all active staff
-- This ensures existing staff members get access to the scheduler tool
INSERT INTO tool_access (tool_id, user_email, granted_at)
SELECT 'scheduler', email, NOW()
FROM staff
WHERE is_active = TRUE
ON CONFLICT (tool_id, user_email) DO NOTHING;

-- Step 4: Create trigger function for auto-granting access on INSERT
CREATE OR REPLACE FUNCTION grant_scheduler_access_on_staff_add()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-grant tool_access when a new staff member is added
  INSERT INTO tool_access (tool_id, user_email, granted_at)
  VALUES ('scheduler', NEW.email, NOW())
  ON CONFLICT (tool_id, user_email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_added_grant_access
AFTER INSERT ON staff
FOR EACH ROW
EXECUTE FUNCTION grant_scheduler_access_on_staff_add();

-- Step 5: Create trigger function for auto-revoking/re-granting on UPDATE
CREATE OR REPLACE FUNCTION handle_scheduler_access_on_staff_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If staff member is deactivated, revoke access
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    DELETE FROM tool_access 
    WHERE tool_id = 'scheduler' AND user_email = NEW.email;
  
  -- If staff member is reactivated, re-grant access
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    INSERT INTO tool_access (tool_id, user_email, granted_at)
    VALUES ('scheduler', NEW.email, NOW())
    ON CONFLICT (tool_id, user_email) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_activation_changed
AFTER UPDATE OF is_active ON staff
FOR EACH ROW
EXECUTE FUNCTION handle_scheduler_access_on_staff_update();

-- Step 6: Create trigger function for auto-revoking access on DELETE
CREATE OR REPLACE FUNCTION revoke_scheduler_access_on_staff_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Revoke tool_access when staff member is deleted
  DELETE FROM tool_access 
  WHERE tool_id = 'scheduler' AND user_email = OLD.email;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_deleted_revoke_access
AFTER DELETE ON staff
FOR EACH ROW
EXECUTE FUNCTION revoke_scheduler_access_on_staff_delete();

-- ============================================================================
-- End of migration
-- ============================================================================
