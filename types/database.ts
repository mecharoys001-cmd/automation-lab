/**
 * Symphonix Scheduling Platform — TypeScript Types
 *
 * All interfaces match the PostgreSQL schema defined in 001_schema.sql.
 * Ready for use with the Supabase client in the Next.js frontend.
 */

// ============================================================
// Enum types (mirrors PostgreSQL ENUMs)
// ============================================================

export type RoleLevel = 'master' | 'standard' | 'editor';

export type CalendarStatusType =
  | 'no_school'
  | 'early_dismissal'
  | 'instructor_exception';

export type SessionStatus = 'draft' | 'published' | 'canceled' | 'completed';

export type NotificationChannel = 'email' | 'sms';

export type NotificationStatus = 'queued' | 'sent' | 'failed';

export type RuleType = 'blackout_day' | 'makeup_day';

export type TemplateType = 'fully_defined' | 'tagged_slot' | 'auto_assign' | 'time_block';

export type RotationMode = 'consistent' | 'rotate';

export type SchedulingMode = 'date_range' | 'duration' | 'session_count' | 'ongoing';

// ============================================================
// Availability JSON structure (shared by instructors & venues)
// ============================================================

export interface TimeBlock {
  start: string; // HH:MM (24h)
  end: string;   // HH:MM (24h)
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type AvailabilityJson = Partial<Record<DayOfWeek, TimeBlock[]>>;

// ============================================================
// Table interfaces
// ============================================================

/** 3.1 admins — Access control via Google identity */
export interface Admin {
  id: string;
  google_email: string;
  display_name: string | null;
  role_level: RoleLevel;
  created_at: string;
}

/** 3.2 instructors — Teaching artists with skills & availability */
export interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  skills: string[] | null;
  availability_json: AvailabilityJson | null;
  is_active: boolean;
  on_call: boolean;
  notes: string | null;
  bio: string | null;
  start_year: number | null;
  created_at: string;
  updated_at: string;
}

/** 3.3 venues — Physical or virtual spaces */
export interface Venue {
  id: string;
  name: string;
  space_type: string;
  max_capacity: number | null;
  availability_json: AvailabilityJson | null;
  is_virtual: boolean;
  notes: string | null;
  min_booking_duration_minutes: number | null;
  max_booking_duration_minutes: number | null;
  buffer_minutes: number | null;
  advance_booking_days: number | null;
  cancellation_window_hours: number | null;
  address: string | null;
  amenities: string[] | null;
  cost_per_hour: number | null;
  max_concurrent_bookings: number;
  blackout_dates: string[] | null;
  description: string | null;
  is_wheelchair_accessible: boolean;
  subjects?: string[] | null;
  created_at: string;
}

/** 3.4 programs — Overarching term, residency, or event series */
export interface Program {
  id: string;
  name: string;
  start_date: string; // DATE as ISO string
  end_date: string;
  allows_mixing: boolean;
  default_venue_id: string | null;
  wizard_completed: boolean;
  wizard_step: number;
  created_at: string;
}

/** 3.5 school_calendar — Blackout dates, early dismissals, exceptions */
export interface SchoolCalendar {
  id: string;
  program_id: string;
  date: string;
  description: string | null;
  status_type: CalendarStatusType;
  early_dismissal_time: string | null; // TIME as HH:MM:SS
  target_instructor_id: string | null;
  created_at: string;
}

/** 3.6 Event Templates (session_templates table) — Recurring weekly patterns */
export interface SessionTemplate {
  id: string;
  program_id: string;
  /** User-defined display name for the template */
  name: string;
  template_type: TemplateType;
  rotation_mode: RotationMode;
  instructor_id: string | null;
  day_of_week: number | null; // 0=Sunday ... 6=Saturday, null = flexible
  grade_groups: string[];
  start_time: string;
  end_time: string;
  duration_minutes: number;
  venue_id: string | null;
  required_skills: string[] | null;
  /** Optional additional tags (any category) */
  additional_tags: string[] | null;
  sort_order: number | null;
  is_active: boolean;
  /** Multi-week cycle length. null or 1 = weekly (every week). 2+ = repeats every N weeks. */
  week_cycle_length: number | null;
  /** 0-indexed week position within the cycle. e.g. 0 = Week 1, 1 = Week 2, etc. */
  week_in_cycle: number | null;
  /** Scheduling mode: how this template generates sessions */
  scheduling_mode: SchedulingMode;
  /** Start date for date_range, duration, or session_count modes */
  starts_on: string | null;
  /** End date for date_range mode */
  ends_on: string | null;
  /** Number of weeks for duration mode */
  duration_weeks: number | null;
  /** Number of sessions for session_count mode */
  session_count: number | null;
  /** Max weeks window for session_count mode */
  within_weeks: number | null;
  /** How many sessions per week (1=once, 5=daily). Default 1. */
  sessions_per_week: number;
  created_at: string;
}

/** 3.7 tags — Reusable labels for filtering and reporting */
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  emoji: string | null;
  description: string | null;
  category: string; // Tag category (e.g., "Instrument", "Grade Level", "Event Type")
  created_at: string;
}

/** 3.8 sessions — The master schedule (one row = one concrete event) */
export interface Session {
  id: string;
  program_id: string;
  template_id: string | null;
  name: string;
  staff_id: string | null;
  venue_id: string | null;
  grade_groups: string[];
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: SessionStatus;
  is_makeup: boolean;
  replaces_session_id: string | null;
  needs_resolution: boolean;
  notes: string | null;
  scheduling_notes?: string | null; // Optional: column not yet in database
  created_at: string;
  updated_at: string;
}

/** 3.9 session_tags — Junction table (many-to-many) */
export interface SessionTag {
  session_id: string;
  tag_id: string;
}

/** 3.9b venue_tags — Junction table (many-to-many) */
export interface VenueTag {
  venue_id: string;
  tag_id: string;
}

/** 3.10 notification_log — Audit trail for outbound communications */
export interface NotificationLog {
  id: string;
  session_id: string | null;
  instructor_id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  message_preview: string | null;
  sent_at: string | null;
  created_at: string;
}

/** program_rules — Recurring blackout/makeup day rules */
export interface ProgramRule {
  id: string;
  program_id: string;
  rule_type: RuleType;
  day_of_week: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// Insert types (omit server-generated fields)
// ============================================================

export type AdminInsert = Omit<Admin, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InstructorInsert = Omit<Instructor, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type VenueInsert = Omit<Venue, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ProgramInsert = Omit<Program, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type SchoolCalendarInsert = Omit<SchoolCalendar, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type SessionTemplateInsert = Omit<SessionTemplate, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type TagInsert = Omit<Tag, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type SessionInsert = Omit<Session, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type SessionTagInsert = SessionTag;

export type VenueTagInsert = VenueTag;

export type NotificationLogInsert = Omit<NotificationLog, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ProgramRuleInsert = Omit<ProgramRule, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// ============================================================
// Update types (all fields optional except id)
// ============================================================

export type AdminUpdate = Partial<Omit<Admin, 'id'>>;
export type InstructorUpdate = Partial<Omit<Instructor, 'id'>>;
export type VenueUpdate = Partial<Omit<Venue, 'id'>>;
export type ProgramUpdate = Partial<Omit<Program, 'id'>>;
export type SchoolCalendarUpdate = Partial<Omit<SchoolCalendar, 'id'>>;
export type SessionTemplateUpdate = Partial<Omit<SessionTemplate, 'id'>>;
export type TagUpdate = Partial<Omit<Tag, 'id'>>;
export type SessionUpdate = Partial<Omit<Session, 'id'>>;
export type NotificationLogUpdate = Partial<Omit<NotificationLog, 'id'>>;
export type ProgramRuleUpdate = Partial<Omit<ProgramRule, 'id'>>;

// ============================================================
// Joined/enriched types (for UI display)
// ============================================================

/** Session with joined venue, instructor, tags, and template info */
export interface SessionWithRelations extends Session {
  venue?: Venue | null;
  instructor?: Instructor | null;
  tags?: Tag[];
  template?: SessionTemplate | null;
  program?: Program | null;
}

/** Notification log with joined session and instructor */
export interface NotificationLogWithRelations extends NotificationLog {
  session?: Session | null;
  instructor?: Instructor | null;
}

// ============================================================
// Supabase Database type (for createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      admins: {
        Row: Admin;
        Insert: AdminInsert;
        Update: AdminUpdate;
      };
      instructors: {
        Row: Instructor;
        Insert: InstructorInsert;
        Update: InstructorUpdate;
      };
      venues: {
        Row: Venue;
        Insert: VenueInsert;
        Update: VenueUpdate;
      };
      programs: {
        Row: Program;
        Insert: ProgramInsert;
        Update: ProgramUpdate;
      };
      school_calendar: {
        Row: SchoolCalendar;
        Insert: SchoolCalendarInsert;
        Update: SchoolCalendarUpdate;
      };
      session_templates: {
        Row: SessionTemplate;
        Insert: SessionTemplateInsert;
        Update: SessionTemplateUpdate;
      };
      tags: {
        Row: Tag;
        Insert: TagInsert;
        Update: TagUpdate;
      };
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: SessionUpdate;
      };
      session_tags: {
        Row: SessionTag;
        Insert: SessionTagInsert;
        Update: SessionTag;
      };
      notification_log: {
        Row: NotificationLog;
        Insert: NotificationLogInsert;
        Update: NotificationLogUpdate;
      };
      program_rules: {
        Row: ProgramRule;
        Insert: ProgramRuleInsert;
        Update: ProgramRuleUpdate;
      };
    };
    Enums: {
      role_level: RoleLevel;
      calendar_status_type: CalendarStatusType;
      session_status: SessionStatus;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      rule_type: RuleType;
      template_type: TemplateType;
      rotation_mode: RotationMode;
      scheduling_mode: SchedulingMode;
    };
  };
}

/** JSONB snapshot stored inside schedule_versions */
export interface ScheduleSnapshot {
  sessions: Session[];
  session_tags: SessionTag[];
  session_templates: SessionTemplate[];
  school_calendar: SchoolCalendar[];
  settings: any; // TODO: Define proper Settings type
  instructors: Instructor[];
  venues: Venue[];
  tags: Tag[];
}
