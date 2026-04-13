/**
 * Default tags and space types for Symphonix Scheduler.
 *
 * These represent common music education organizational structure
 * and are always included when seeding data, regardless of dataset size.
 * They get re-created on every seed so users never lose their
 * basic organizational structure.
 */

export interface TagPreset {
  name: string;
  color: string;
  emoji?: string;
  category?: string;
  description?: string;
}

// ── Skill Levels ──────────────────────────────────────────
// ── Instruments ───────────────────────────────────────────
// ── Event Types ───────────────────────────────────────────
export const DEFAULT_TAGS: TagPreset[] = [
  // Skill Levels
  { name: 'Beginner', color: '#22C55E', emoji: '🌱', category: 'Skill Level', description: 'Entry-level students' },
  { name: 'Intermediate', color: '#F59E0B', emoji: '📈', category: 'Skill Level', description: 'Students with foundational skills' },
  { name: 'Advanced', color: '#EF4444', emoji: '⭐', category: 'Skill Level', description: 'Experienced students' },

  // Instruments
  { name: 'Piano', color: '#6366F1', emoji: '🎹', category: 'Instrument' },
  { name: 'Violin', color: '#8B5CF6', emoji: '🎻', category: 'Instrument' },
  { name: 'Guitar', color: '#A855F7', emoji: '🎸', category: 'Instrument' },
  { name: 'Voice', color: '#EC4899', emoji: '🎤', category: 'Instrument' },
  { name: 'Drums', color: '#F97316', emoji: '🥁', category: 'Instrument' },
  { name: 'Cello', color: '#14B8A6', emoji: '🎻', category: 'Instrument' },
  { name: 'Flute', color: '#06B6D4', emoji: '🪈', category: 'Instrument' },
  { name: 'Trumpet', color: '#3B82F6', emoji: '🎺', category: 'Instrument' },
  { name: 'Clarinet', color: '#84CC16', emoji: '🎷', category: 'Instrument' },
  { name: 'Saxophone', color: '#EAB308', emoji: '🎷', category: 'Instrument' },

  // Event Types
  { name: 'Group', color: '#3B82F6', emoji: '👥', category: 'Event Type', description: 'Group instruction session' },
  { name: 'Private', color: '#8B5CF6', emoji: '👤', category: 'Event Type', description: 'One-on-one instruction' },
  { name: 'Theory', color: '#6366F1', emoji: '📚', category: 'Event Type', description: 'Music theory class' },
  { name: 'Performance', color: '#EC4899', emoji: '🎭', category: 'Event Type', description: 'Performance preparation or showcase' },
  { name: 'Recital Prep', color: '#F43F5E', emoji: '🎪', category: 'Event Type', description: 'Recital preparation session' },
];

// ── Space Types ─────────────────────────────────────────
export const DEFAULT_SPACE_TYPES: TagPreset[] = [
  { name: 'Classroom', color: '#3B82F6', emoji: '🏫', category: 'Space Types', description: 'Standard classroom for instruction' },
  { name: 'Studio', color: '#8B5CF6', emoji: '🎨', category: 'Space Types', description: 'Music or art studio' },
  { name: 'Performance Hall', color: '#EC4899', emoji: '🎭', category: 'Space Types', description: 'Large performance venue' },
  { name: 'Practice Room', color: '#14B8A6', emoji: '🎵', category: 'Space Types', description: 'Small room for individual practice' },
  { name: 'Rehearsal Space', color: '#F59E0B', emoji: '🎪', category: 'Space Types', description: 'Room for group rehearsals' },
  { name: 'Auditorium', color: '#EF4444', emoji: '🎬', category: 'Space Types', description: 'Large assembly or performance hall' },
  { name: 'Virtual', color: '#06B6D4', emoji: '💻', category: 'Space Types', description: 'Online or remote venue' },
  { name: 'Multipurpose', color: '#84CC16', emoji: '🔄', category: 'Space Types', description: 'Flexible multi-use space' },
];

// ── Staff Types ─────────────────────────────────────────
export const DEFAULT_STAFF_TYPES: TagPreset[] = [
  { name: 'ASAP! TA', color: '#2563EB', emoji: '🧑‍🏫', category: 'Staff Type', description: 'ASAP! teaching artist' },
  { name: 'Partner Staff', color: '#7C3AED', emoji: '🤝', category: 'Staff Type', description: 'Partner organization staff member' },
  { name: 'ASAP! Staff', color: '#DB2777', emoji: '⭐', category: 'Staff Type', description: 'ASAP! staff member' },
];

/** Merges default tags with preset-specific tags, deduplicating by name (defaults take priority) */
export function mergeWithDefaults(presetTags: TagPreset[]): TagPreset[] {
  const all = [...DEFAULT_TAGS, ...DEFAULT_SPACE_TYPES, ...DEFAULT_STAFF_TYPES, ...presetTags];
  const seen = new Set<string>();
  return all.filter(t => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}
