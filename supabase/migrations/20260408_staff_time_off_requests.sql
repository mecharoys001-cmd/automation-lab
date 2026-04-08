-- Staff Time Off Requests
-- Allows staff to submit vacation/absence requests for admin review.
-- Approved requests surface impact warnings in Schedule Preview without
-- automatically disqualifying staff from recurring assignments.

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE time_off_request_type AS ENUM ('full_day', 'partial_day', 'multi_day');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE time_off_request_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_time_off_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  request_type  time_off_request_type NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  start_time    time,          -- only for partial_day
  end_time      time,          -- only for partial_day
  note          text NOT NULL,
  status        time_off_request_status NOT NULL DEFAULT 'pending',
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid REFERENCES admins(id),
  review_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_time_off_program
  ON staff_time_off_requests (program_id);

CREATE INDEX IF NOT EXISTS idx_staff_time_off_staff
  ON staff_time_off_requests (staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_time_off_status
  ON staff_time_off_requests (status);

CREATE INDEX IF NOT EXISTS idx_staff_time_off_dates
  ON staff_time_off_requests (start_date, end_date);

-- ── Auto-update updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_staff_time_off_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_time_off_updated_at ON staff_time_off_requests;
CREATE TRIGGER trg_staff_time_off_updated_at
  BEFORE UPDATE ON staff_time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_time_off_updated_at();
