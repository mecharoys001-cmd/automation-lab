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
  category?: string;
  description?: string;
}

// ── Skill Levels ──────────────────────────────────────────
// ── Instruments ───────────────────────────────────────────
// ── Class Types ───────────────────────────────────────────
export const DEFAULT_TAGS: TagPreset[] = [
  // Skill Levels
  { name: 'Beginner', color: '#22C55E', category: 'Skill Level', description: 'Entry-level students' },
  { name: 'Intermediate', color: '#F59E0B', category: 'Skill Level', description: 'Students with foundational skills' },
  { name: 'Advanced', color: '#EF4444', category: 'Skill Level', description: 'Experienced students' },

  // Instruments
  { name: 'Piano', color: '#6366F1', category: 'Instrument' },
  { name: 'Violin', color: '#8B5CF6', category: 'Instrument' },
  { name: 'Guitar', color: '#A855F7', category: 'Instrument' },
  { name: 'Voice', color: '#EC4899', category: 'Instrument' },
  { name: 'Drums', color: '#F97316', category: 'Instrument' },
  { name: 'Cello', color: '#14B8A6', category: 'Instrument' },
  { name: 'Flute', color: '#06B6D4', category: 'Instrument' },
  { name: 'Trumpet', color: '#3B82F6', category: 'Instrument' },
  { name: 'Clarinet', color: '#84CC16', category: 'Instrument' },
  { name: 'Saxophone', color: '#EAB308', category: 'Instrument' },

  // Class Types
  { name: 'Group', color: '#3B82F6', category: 'Class Type', description: 'Group instruction session' },
  { name: 'Private', color: '#8B5CF6', category: 'Class Type', description: 'One-on-one instruction' },
  { name: 'Theory', color: '#6366F1', category: 'Class Type', description: 'Music theory class' },
  { name: 'Performance', color: '#EC4899', category: 'Class Type', description: 'Performance preparation or showcase' },
  { name: 'Recital Prep', color: '#F43F5E', category: 'Class Type', description: 'Recital preparation session' },
];

// ── Space Types ─────────────────────────────────────────
export const DEFAULT_SPACE_TYPES: TagPreset[] = [
  { name: 'Classroom', color: '#3B82F6', category: 'Space Types', description: 'Standard classroom for instruction' },
  { name: 'Studio', color: '#8B5CF6', category: 'Space Types', description: 'Music or art studio' },
  { name: 'Performance Hall', color: '#EC4899', category: 'Space Types', description: 'Large performance venue' },
  { name: 'Practice Room', color: '#14B8A6', category: 'Space Types', description: 'Small room for individual practice' },
  { name: 'Rehearsal Space', color: '#F59E0B', category: 'Space Types', description: 'Room for group rehearsals' },
  { name: 'Auditorium', color: '#EF4444', category: 'Space Types', description: 'Large assembly or performance hall' },
  { name: 'Virtual', color: '#06B6D4', category: 'Space Types', description: 'Online or remote venue' },
  { name: 'Multipurpose', color: '#84CC16', category: 'Space Types', description: 'Flexible multi-use space' },
];

/** Merges default tags with preset-specific tags, deduplicating by name (defaults take priority) */
export function mergeWithDefaults(presetTags: TagPreset[]): TagPreset[] {
  const all = [...DEFAULT_TAGS, ...DEFAULT_SPACE_TYPES, ...presetTags];
  const seen = new Set<string>();
  return all.filter(t => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}
