export type EventType = 'strings' | 'brass' | 'piano' | 'percussion' | 'choral';

export const EVENT_COLORS: Record<EventType, { accent: string; bg: string; text: string }> = {
  strings:    { accent: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  brass:      { accent: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  piano:      { accent: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  percussion: { accent: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
  choral:     { accent: '#10B981', bg: '#ECFDF5', text: '#065F46' },
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  strings: 'Strings',
  brass: 'Brass',
  piano: 'Piano',
  percussion: 'Percussion',
  choral: 'Choral',
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
  tags?: string[];
  notes?: string;      // session notes
}
