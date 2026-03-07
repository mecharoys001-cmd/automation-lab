-- ============================================================
-- Symphonix Scheduler — Base Schema Migration
-- Generated from types/database.ts
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE role_level AS ENUM ('master', 'standard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE calendar_status_type AS ENUM ('no_school', 'early_dismissal', 'instructor_exception');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('draft', 'published', 'canceled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rule_type AS ENUM ('blackout_day', 'makeup_day');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE template_type AS ENUM ('fully_defined', 'tagged_slot', 'auto_assign', 'time_block');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rotation_mode AS ENUM ('consistent', 'rotate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. TABLES (ordered so foreign keys reference existing tables)
-- ============================================================

-- 2.1 admins
CREATE TABLE IF NOT EXISTS admins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_email text NOT NULL UNIQUE,
  display_name text,
  role_level  role_level NOT NULL DEFAULT 'standard',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admins IS 'Access control via Google identity';

-- 2.2 instructors
CREATE TABLE IF NOT EXISTS instructors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name        text NOT NULL,
  last_name         text NOT NULL,
  email             text,
  phone             text,
  skills            text[],
  availability_json jsonb,
  is_active         boolean NOT NULL DEFAULT true,
  on_call           boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE instructors IS 'Teaching artists with skills & availability';

-- 2.3 venues
CREATE TABLE IF NOT EXISTS venues (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  space_type                  text NOT NULL,
  max_capacity                integer,
  availability_json           jsonb,
  is_virtual                  boolean NOT NULL DEFAULT false,
  notes                       text,
  min_booking_duration_minutes integer,
  max_booking_duration_minutes integer,
  buffer_minutes              integer,
  advance_booking_days        integer,
  cancellation_window_hours   integer,
  address                     text,
  amenities                   text[],
  cost_per_hour               numeric,
  max_concurrent_bookings     integer NOT NULL DEFAULT 1,
  blackout_dates              text[],
  description                 text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE venues IS 'Physical or virtual spaces';

-- 2.4 programs
CREATE TABLE IF NOT EXISTS programs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  allows_mixing    boolean NOT NULL DEFAULT false,
  default_venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programs_date_range CHECK (end_date >= start_date)
);

COMMENT ON TABLE programs IS 'Overarching term, residency, or event series';

-- 2.5 tags
CREATE TABLE IF NOT EXISTS tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text,
  description text,
  category    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_category_unique UNIQUE (name, category)
);

COMMENT ON TABLE tags IS 'Reusable labels for filtering and reporting';

-- 2.6 school_calendar
CREATE TABLE IF NOT EXISTS school_calendar (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id            uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  date                  date NOT NULL,
  description           text,
  status_type           calendar_status_type NOT NULL,
  early_dismissal_time  time,
  target_instructor_id  uuid REFERENCES instructors(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE school_calendar IS 'Blackout dates, early dismissals, instructor exceptions';

-- 2.7 session_templates
CREATE TABLE IF NOT EXISTS session_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  template_type    template_type NOT NULL DEFAULT 'fully_defined',
  rotation_mode    rotation_mode NOT NULL DEFAULT 'consistent',
  instructor_id    uuid REFERENCES instructors(id) ON DELETE SET NULL,
  day_of_week      smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  grade_groups     text[] NOT NULL DEFAULT '{}',
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  duration_minutes integer NOT NULL,
  venue_id         uuid REFERENCES venues(id) ON DELETE SET NULL,
  required_skills  text[],
  sort_order       integer,
  is_active        boolean NOT NULL DEFAULT true,
  week_cycle_length integer,
  week_in_cycle    integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_templates IS 'Recurring weekly event patterns';
COMMENT ON COLUMN session_templates.day_of_week IS '0=Sunday ... 6=Saturday';
COMMENT ON COLUMN session_templates.week_cycle_length IS 'Multi-week cycle length. NULL or 1 = weekly. 2+ = every N weeks.';
COMMENT ON COLUMN session_templates.week_in_cycle IS '0-indexed week position within the cycle';

-- 2.8 sessions
CREATE TABLE IF NOT EXISTS sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  template_id         uuid REFERENCES session_templates(id) ON DELETE SET NULL,
  instructor_id       uuid REFERENCES instructors(id) ON DELETE SET NULL,
  venue_id            uuid REFERENCES venues(id) ON DELETE SET NULL,
  grade_groups        text[] NOT NULL DEFAULT '{}',
  date                date NOT NULL,
  start_time          time NOT NULL,
  end_time            time NOT NULL,
  duration_minutes    integer NOT NULL,
  status              session_status NOT NULL DEFAULT 'draft',
  is_makeup           boolean NOT NULL DEFAULT false,
  replaces_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  needs_resolution    boolean NOT NULL DEFAULT false,
  notes               text,
  scheduling_notes    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sessions IS 'Master schedule — one row per concrete event';

-- 2.9 session_tags (junction table)
CREATE TABLE IF NOT EXISTS session_tags (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, tag_id)
);

COMMENT ON TABLE session_tags IS 'Many-to-many relationship between sessions and tags';

-- 2.10 notification_log
CREATE TABLE IF NOT EXISTS notification_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES sessions(id) ON DELETE SET NULL,
  instructor_id   uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL,
  status          notification_status NOT NULL DEFAULT 'queued',
  message_preview text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_log IS 'Audit trail for outbound communications';

-- 2.11 program_rules
CREATE TABLE IF NOT EXISTS program_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  rule_type   rule_type NOT NULL,
  day_of_week smallint CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE program_rules IS 'Recurring blackout/makeup day rules per program';

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- admins
CREATE INDEX IF NOT EXISTS idx_admins_google_email ON admins (google_email);

-- instructors
CREATE INDEX IF NOT EXISTS idx_instructors_is_active ON instructors (is_active);
CREATE INDEX IF NOT EXISTS idx_instructors_email ON instructors (email);

-- venues
CREATE INDEX IF NOT EXISTS idx_venues_space_type ON venues (space_type);
CREATE INDEX IF NOT EXISTS idx_venues_is_virtual ON venues (is_virtual);

-- programs
CREATE INDEX IF NOT EXISTS idx_programs_dates ON programs (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_programs_default_venue ON programs (default_venue_id);

-- school_calendar
CREATE INDEX IF NOT EXISTS idx_school_calendar_program ON school_calendar (program_id);
CREATE INDEX IF NOT EXISTS idx_school_calendar_date ON school_calendar (date);
CREATE INDEX IF NOT EXISTS idx_school_calendar_program_date ON school_calendar (program_id, date);

-- session_templates
CREATE INDEX IF NOT EXISTS idx_session_templates_program ON session_templates (program_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_instructor ON session_templates (instructor_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_day ON session_templates (day_of_week);
CREATE INDEX IF NOT EXISTS idx_session_templates_venue ON session_templates (venue_id);

-- sessions
CREATE INDEX IF NOT EXISTS idx_sessions_program ON sessions (program_id);
CREATE INDEX IF NOT EXISTS idx_sessions_template ON sessions (template_id);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON sessions (instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_venue ON sessions (venue_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_program_date ON sessions (program_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_needs_resolution ON sessions (needs_resolution) WHERE needs_resolution = true;

-- session_tags
CREATE INDEX IF NOT EXISTS idx_session_tags_tag ON session_tags (tag_id);

-- notification_log
CREATE INDEX IF NOT EXISTS idx_notification_log_session ON notification_log (session_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_instructor ON notification_log (instructor_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log (status);

-- program_rules
CREATE INDEX IF NOT EXISTS idx_program_rules_program ON program_rules (program_id);
CREATE INDEX IF NOT EXISTS idx_program_rules_active ON program_rules (program_id, is_active) WHERE is_active = true;

-- ============================================================
-- 4. TRIGGERS — auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_instructors_updated_at
    BEFORE UPDATE ON instructors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
