-- ============================================================
-- Migration: Rename instructors → staff
-- Date: 2026-03-29
-- ============================================================

-- ============================================================
-- 1. Rename the table
-- ============================================================
ALTER TABLE instructors RENAME TO staff;

-- ============================================================
-- 2. Rename foreign key columns in referencing tables
-- ============================================================

-- school_calendar: target_instructor_id → target_staff_id
ALTER TABLE school_calendar RENAME COLUMN target_instructor_id TO target_staff_id;

-- session_templates: instructor_id → staff_id
ALTER TABLE session_templates RENAME COLUMN instructor_id TO staff_id;

-- sessions: instructor_id → staff_id
ALTER TABLE sessions RENAME COLUMN instructor_id TO staff_id;

-- notification_log: instructor_id → staff_id
ALTER TABLE notification_log RENAME COLUMN instructor_id TO staff_id;

-- ============================================================
-- 3. Rename indexes (drop old, create new)
-- ============================================================

-- staff table indexes
DROP INDEX IF EXISTS idx_instructors_is_active;
DROP INDEX IF EXISTS idx_instructors_email;
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff (is_active);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff (email);

-- session_templates
DROP INDEX IF EXISTS idx_session_templates_instructor;
CREATE INDEX IF NOT EXISTS idx_session_templates_staff ON session_templates (staff_id);

-- sessions
DROP INDEX IF EXISTS idx_sessions_instructor;
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions (staff_id);

-- notification_log
DROP INDEX IF EXISTS idx_notification_log_instructor;
CREATE INDEX IF NOT EXISTS idx_notification_log_staff ON notification_log (staff_id);

-- ============================================================
-- 4. Rename the updated_at trigger
-- ============================================================
DROP TRIGGER IF EXISTS set_instructors_updated_at ON staff;

DO $$ BEGIN
  CREATE TRIGGER set_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. Update table comments
-- ============================================================
COMMENT ON TABLE staff IS 'Teaching artists / staff members with skills & availability';

-- ============================================================
-- 6. Backfill tool_access for existing active staff
-- ============================================================
INSERT INTO tool_access (tool_id, user_email, granted_at)
SELECT 'scheduler', email, NOW()
FROM staff
WHERE is_active = TRUE AND email IS NOT NULL
ON CONFLICT (tool_id, user_email) DO NOTHING;

-- ============================================================
-- 7. Auto-grant/revoke triggers for tool_access
-- ============================================================

-- ON INSERT → grant scheduler access
CREATE OR REPLACE FUNCTION grant_scheduler_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    INSERT INTO tool_access (tool_id, user_email, granted_at)
    VALUES ('scheduler', NEW.email, NOW())
    ON CONFLICT (tool_id, user_email) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_added_grant_access
AFTER INSERT ON staff
FOR EACH ROW
EXECUTE FUNCTION grant_scheduler_access();

-- ON UPDATE (is_active change) → grant or revoke
CREATE OR REPLACE FUNCTION revoke_scheduler_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    DELETE FROM tool_access
    WHERE tool_id = 'scheduler' AND user_email = NEW.email;
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    IF NEW.email IS NOT NULL THEN
      INSERT INTO tool_access (tool_id, user_email, granted_at)
      VALUES ('scheduler', NEW.email, NOW())
      ON CONFLICT (tool_id, user_email) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_activation_change
AFTER UPDATE OF is_active ON staff
FOR EACH ROW
EXECUTE FUNCTION revoke_scheduler_access();

-- ON DELETE → revoke access
CREATE OR REPLACE FUNCTION revoke_scheduler_access_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS NOT NULL THEN
    DELETE FROM tool_access
    WHERE tool_id = 'scheduler' AND user_email = OLD.email;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_deleted_revoke_access
AFTER DELETE ON staff
FOR EACH ROW
EXECUTE FUNCTION revoke_scheduler_access_on_delete();
