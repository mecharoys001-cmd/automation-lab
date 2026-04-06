-- ============================================================================
-- Migration: Scheduler access consistency
-- ============================================================================
-- Problem: Scheduler admins (admins table) were not synced to tool_access,
-- and staff deactivation/deletion could remove tool_access even if the user
-- was still in the admins table. This caused the scheduler card to disappear
-- from /tools for users who should still have access.
--
-- Fix:
-- 1. Shared recompute function that checks ALL scheduler access sources
-- 2. Replace staff triggers to use the recompute function
-- 3. Add admins triggers to use the recompute function
-- 4. Backfill tool_access for existing admins
-- ============================================================================

-- Step 1: Create the shared recompute function
-- This is the single source of truth for whether a user should have
-- scheduler tool_access. It checks admins + active staff and only
-- removes the row if NO source still grants access.
CREATE OR REPLACE FUNCTION recompute_scheduler_tool_access(p_email text)
RETURNS void AS $$
DECLARE
  has_access boolean := false;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RETURN;
  END IF;

  -- Check if user is a scheduler admin
  PERFORM 1 FROM admins WHERE lower(google_email) = lower(p_email) LIMIT 1;
  IF FOUND THEN
    has_access := true;
  END IF;

  -- Check if user is active staff
  IF NOT has_access THEN
    PERFORM 1 FROM staff WHERE lower(email) = lower(p_email) AND is_active = true LIMIT 1;
    IF FOUND THEN
      has_access := true;
    END IF;
  END IF;

  -- Sync tool_access row
  IF has_access THEN
    INSERT INTO tool_access (tool_id, user_email, granted_at)
    VALUES ('scheduler', p_email, NOW())
    ON CONFLICT (tool_id, user_email) DO NOTHING;
  ELSE
    DELETE FROM tool_access
    WHERE tool_id = 'scheduler' AND lower(user_email) = lower(p_email);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Replace staff triggers to use the recompute function
-- Drop old triggers first
DROP TRIGGER IF EXISTS staff_added_grant_access ON staff;
DROP TRIGGER IF EXISTS staff_activation_changed ON staff;
DROP TRIGGER IF EXISTS staff_deleted_revoke_access ON staff;

-- Replace: staff INSERT trigger
CREATE OR REPLACE FUNCTION grant_scheduler_access_on_staff_add()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email != '' AND NEW.is_active = true THEN
    PERFORM recompute_scheduler_tool_access(NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_added_grant_access
AFTER INSERT ON staff
FOR EACH ROW
EXECUTE FUNCTION grant_scheduler_access_on_staff_add();

-- Replace: staff UPDATE trigger (is_active or email change)
CREATE OR REPLACE FUNCTION handle_scheduler_access_on_staff_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If email changed, recompute for both old and new email
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    IF OLD.email IS NOT NULL AND OLD.email != '' THEN
      PERFORM recompute_scheduler_tool_access(OLD.email);
    END IF;
    IF NEW.email IS NOT NULL AND NEW.email != '' THEN
      PERFORM recompute_scheduler_tool_access(NEW.email);
    END IF;
  -- If only is_active changed, recompute for current email
  ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    IF NEW.email IS NOT NULL AND NEW.email != '' THEN
      PERFORM recompute_scheduler_tool_access(NEW.email);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_activation_changed
AFTER UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION handle_scheduler_access_on_staff_update();

-- Replace: staff DELETE trigger
CREATE OR REPLACE FUNCTION revoke_scheduler_access_on_staff_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    PERFORM recompute_scheduler_tool_access(OLD.email);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_deleted_revoke_access
AFTER DELETE ON staff
FOR EACH ROW
EXECUTE FUNCTION revoke_scheduler_access_on_staff_delete();

-- Step 3: Add admins triggers (new — previously missing)
CREATE OR REPLACE FUNCTION grant_scheduler_access_on_admin_add()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.google_email IS NOT NULL AND NEW.google_email != '' THEN
    PERFORM recompute_scheduler_tool_access(NEW.google_email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_added_grant_access
AFTER INSERT ON admins
FOR EACH ROW
EXECUTE FUNCTION grant_scheduler_access_on_admin_add();

CREATE OR REPLACE FUNCTION handle_scheduler_access_on_admin_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If email changed, recompute for both old and new
  IF OLD.google_email IS DISTINCT FROM NEW.google_email THEN
    IF OLD.google_email IS NOT NULL AND OLD.google_email != '' THEN
      PERFORM recompute_scheduler_tool_access(OLD.google_email);
    END IF;
    IF NEW.google_email IS NOT NULL AND NEW.google_email != '' THEN
      PERFORM recompute_scheduler_tool_access(NEW.google_email);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_updated_sync_access
AFTER UPDATE ON admins
FOR EACH ROW
EXECUTE FUNCTION handle_scheduler_access_on_admin_update();

CREATE OR REPLACE FUNCTION revoke_scheduler_access_on_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.google_email IS NOT NULL AND OLD.google_email != '' THEN
    PERFORM recompute_scheduler_tool_access(OLD.google_email);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_deleted_revoke_access
AFTER DELETE ON admins
FOR EACH ROW
EXECUTE FUNCTION revoke_scheduler_access_on_admin_delete();

-- Step 4: Backfill tool_access for all existing admins
-- (Staff were already backfilled in 20260330_rename_instructors_to_staff.sql)
INSERT INTO tool_access (tool_id, user_email, granted_at)
SELECT 'scheduler', google_email, NOW()
FROM admins
WHERE google_email IS NOT NULL AND google_email != ''
ON CONFLICT (tool_id, user_email) DO NOTHING;

-- ============================================================================
-- End of migration
-- ============================================================================
