import { EVENT_COLORS as UNIFIED_EVENT_COLORS } from '../../lib/subjectColors';

export type EventType = 'strings' | 'brass' | 'piano' | 'percussion' | 'choral' | 'guitar' | 'woodwind' | 'general';

export const EVENT_COLORS: Record<string, { accent: string; bg: string; text: string }> = UNIFIED_EVENT_COLORS;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  strings: 'Strings',
  brass: 'Brass',
  piano: 'Piano',
  percussion: 'Percussion',
  choral: 'Choral',
  guitar: 'Guitar',
  woodwind: 'Woodwind',
  general: 'General',
};

export interface SchoolCalendarEntry {
  date: string; // YYYY-MM-DD
  status_type: 'no_school' | 'early_dismissal' | 'instructor_exception';
  description?: string | null;
  early_dismissal_time?: string | null;
  target_instructor_id?: string | null;
  instructor?: { id: string; first_name: string; last_name: string } | null;
}

export function buildStatusTooltip(entry: SchoolCalendarEntry): string {
  const parts: string[] = [];

  if (entry.status_type === 'no_school') {
    parts.push('No School');
  } else if (entry.status_type === 'early_dismissal') {
    let label = 'Early Dismissal';
    if (entry.early_dismissal_time) {
      label += ' at ' + entry.early_dismissal_time.slice(0, 5);
    }
    parts.push(label);
  } else if (entry.status_type === 'instructor_exception') {
    parts.push('Staff Exception');
    if (entry.instructor) {
      parts.push(entry.instructor.first_name + ' ' + entry.instructor.last_name);
    }
  }

  if (entry.description) {
    parts.push(entry.description);
  }

  return parts.join(' — ');
}

export interface CalendarEvent {
  id: string;
  title: string;
  subtitle: string;
  instructor: string;
  type: EventType;
  time: string;        // e.g. "9:00 AM"
  endTime?: string;    // e.g. "10:00 AM"
  date: string;        // ISO date "YYYY-MM-DD"
  dayIndex?: number;   // 0=Mon…6=Sun (week view compat)
  venue?: string;
  gradeLevel?: string; // e.g. "3rd Grade", "K-2"
  status?: 'draft' | 'published' | 'canceled' | 'completed';
  subjects?: string[]; // e.g. ['strings'], from template.required_skills
  tags?: string[];
  tagEmojis?: Record<string, string>; // tag name → emoji
  notes?: string;      // session notes
  templateId?: string; // session_template id for bulk operations
  // Raw IDs for edit mode
  instructorId?: string;
  venueId?: string;
  sessionName?: string;       // raw name (without grade suffix)
  gradeGroups?: string[];     // raw grade groups e.g. ["3rd", "K"]
  durationMinutes?: number;
  subjectTagId?: string;
}
