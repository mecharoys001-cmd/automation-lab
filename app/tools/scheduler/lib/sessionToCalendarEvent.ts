import type { CalendarEvent, EventType } from '../components/calendar/types';

// ---------------------------------------------------------------------------
// Helpers — map generated sessions to CalendarEvent
// ---------------------------------------------------------------------------

const KNOWN_EVENT_TYPES = ['strings', 'brass', 'piano', 'percussion', 'choral', 'guitar', 'woodwind', 'general'] as const;

/** Convert stored grade ("10th", "Pre-K", "K", "1st") to display format ("Grade 10", "Pre-K", "K", "Grade 1") */
export function formatGradeDisplay(grade: string): string {
  if (grade === 'Pre-K' || grade === 'K') return grade;
  const num = grade.replace(/(st|nd|rd|th)$/i, '');
  return `Grade ${num}`;
}

/** Best-effort mapping from a template's required subjects to an EventType. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deriveEventType(template: any): EventType {
  const skills: string[] = template?.required_skills ?? [];
  const match = KNOWN_EVENT_TYPES.find((t) =>
    skills.some((s: string) => s.toLowerCase().includes(t)),
  );
  return (match ?? 'general') as EventType;
}

/** Convert 24-hour "HH:MM" to display format "9:00 AM". */
export function formatTimeDisplay(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Build a readable title from a generated session's template data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSessionTitle(session: any): string {
  const grades: string[] = session.grade_groups ?? session.template?.grade_groups ?? [];
  const gradeSuffix = grades.length > 0 ? ` - ${grades.map(formatGradeDisplay).join(', ')}` : '';

  // Priority 1: Use session name (e.g. one-off events)
  if (session.name) {
    return `${session.name}${gradeSuffix}`;
  }

  // Priority 2: Use template name if it exists
  if (session.template?.name) {
    return `${session.template.name}${gradeSuffix}`;
  }

  // Priority 3: Use subject/skill
  const skills: string[] = session.template?.required_skills ?? [];
  if (skills.length > 0) {
    const skill = skills[0].charAt(0).toUpperCase() + skills[0].slice(1);
    return `${skill} Session${gradeSuffix}`;
  }

  // Priority 4: Use instructor name
  const instructorName = session.instructor
    ? `${session.instructor.first_name ?? ''} ${session.instructor.last_name ?? ''}`.trim()
    : '';
  if (instructorName) {
    return `${instructorName} Session${gradeSuffix}`;
  }

  // Fallback
  return `Session${gradeSuffix}`;
}

/** Map a raw generated session (with joins) to a CalendarEvent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sessionToCalendarEvent(session: any): CalendarEvent {
  // Instructor name: API returns { first_name, last_name }, not { name }
  const instructorName = session.instructor
    ? `${session.instructor.first_name ?? ''} ${session.instructor.last_name ?? ''}`.trim() || 'Unassigned'
    : 'Unassigned';

  // Tags: API returns tag objects with { id, name, emoji?, ... }, convert to string[]
  const tagNames: string[] = Array.isArray(session.tags)
    ? session.tags.map((t: { name?: string }) => t.name).filter(Boolean)
    : [];
  const tagEmojis: Record<string, string> = {};
  if (Array.isArray(session.tags)) {
    for (const t of session.tags) {
      if (t.name && t.emoji) tagEmojis[t.name] = t.emoji;
    }
  }

  // Populate event types from template skills OR event type category tags
  const templateSubjects = Array.isArray(session.template?.required_skills) ? session.template.required_skills : [];
  const tagSubjects = Array.isArray(session.tags)
    ? session.tags
        .filter((t: { category?: string }) => t.category === 'Event Type')
        .map((t: { name?: string }) => t.name)
        .filter(Boolean)
    : [];
  const allSubjects = [...templateSubjects, ...tagSubjects];

  const gradeLabel = session.grade_groups?.length
    ? session.grade_groups.map(formatGradeDisplay).join(', ')
    : '';

  // Find the event type tag ID from event type category tags
  const subjectTag = Array.isArray(session.tags)
    ? session.tags.find((t: { category?: string }) =>
        t.category === 'Event Type'
      )
    : undefined;

  return {
    id: session.id,
    title: buildSessionTitle(session),
    subtitle: gradeLabel,
    gradeLevel: gradeLabel || undefined,
    instructor: instructorName,
    type: deriveEventType(session.template),
    time: formatTimeDisplay(session.start_time),
    endTime: formatTimeDisplay(session.end_time),
    date: session.date,
    status: session.status ?? 'draft',
    venue: session.venue?.name,
    subjects: allSubjects,
    tags: tagNames,
    tagEmojis: Object.keys(tagEmojis).length > 0 ? tagEmojis : undefined,
    notes: session.notes ?? undefined,
    templateId: session.template_id ?? session.template?.id ?? undefined,
    // Raw IDs for edit mode
    instructorId: session.instructor_id ?? session.instructor?.id ?? undefined,
    venueId: session.venue_id ?? session.venue?.id ?? undefined,
    sessionName: session.name ?? session.template?.name ?? undefined,
    gradeGroups: session.grade_groups ?? session.template?.grade_groups ?? undefined,
    durationMinutes: session.duration_minutes ?? undefined,
    subjectTagId: subjectTag?.id ?? undefined,
  };
}
