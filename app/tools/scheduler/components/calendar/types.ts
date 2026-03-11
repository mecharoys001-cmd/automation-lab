import { EVENT_COLORS as UNIFIED_EVENT_COLORS } from '../../lib/subjectColors';

export type EventType = 'strings' | 'brass' | 'piano' | 'percussion' | 'choral' | 'guitar' | 'woodwind';

export const EVENT_COLORS: Record<string, { accent: string; bg: string; text: string }> = UNIFIED_EVENT_COLORS;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  strings: 'Strings',
  brass: 'Brass',
  piano: 'Piano',
  percussion: 'Percussion',
  choral: 'Choral',
  guitar: 'Guitar',
  woodwind: 'Woodwind',
};

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
  notes?: string;      // session notes
  templateId?: string; // session_template id for bulk operations
}
