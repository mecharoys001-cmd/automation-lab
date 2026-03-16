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
// ── Class Types ───────────────────────────────────────────
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

  // Class Types
  { name: 'Group', color: '#3B82F6', emoji: '👥', category: 'Class Type', description: 'Group instruction session' },
  { name: 'Private', color: '#8B5CF6', emoji: '👤', category: 'Class Type', description: 'One-on-one instruction' },
  { name: 'Theory', color: '#6366F1', emoji: '📚', category: 'Class Type', description: 'Music theory class' },
  { name: 'Performance', color: '#EC4899', emoji: '🎭', category: 'Class Type', description: 'Performance preparation or showcase' },
  { name: 'Recital Prep', color: '#F43F5E', emoji: '🎪', category: 'Class Type', description: 'Recital preparation session' },
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

  // General venue types
  { name: 'Conference Room', color: '#64748B', emoji: '🤝', category: 'Space Types', description: 'Meeting or conference space' },
  { name: 'Library', color: '#78716C', emoji: '📖', category: 'Space Types', description: 'Library or quiet study area' },
  { name: 'Cafeteria / Commons', color: '#D97706', emoji: '🍽️', category: 'Space Types', description: 'Cafeteria or common gathering area' },
  { name: 'Gymnasium', color: '#DC2626', emoji: '🏀', category: 'Space Types', description: 'Gym or large open floor space' },
  { name: 'Theater', color: '#BE185D', emoji: '🎭', category: 'Space Types', description: 'Theater with stage and seating' },

  // Music-specific rooms
  { name: 'Music Room', color: '#7C3AED', emoji: '🎵', category: 'Space Types', description: 'General music instruction room' },
  { name: 'Band Room', color: '#2563EB', emoji: '🎺', category: 'Space Types', description: 'Dedicated band rehearsal and instruction room' },
  { name: 'Choir Room', color: '#DB2777', emoji: '🎤', category: 'Space Types', description: 'Dedicated choral rehearsal room' },
  { name: 'Orchestra Room', color: '#9333EA', emoji: '🎻', category: 'Space Types', description: 'Dedicated orchestra rehearsal room' },
  { name: 'Recording Studio', color: '#4F46E5', emoji: '🎙️', category: 'Space Types', description: 'Audio recording and production studio' },

  // Support spaces
  { name: 'Outdoor Space', color: '#16A34A', emoji: '🌳', category: 'Space Types', description: 'Outdoor area for events or rehearsals' },
  { name: 'Stage', color: '#E11D48', emoji: '🎬', category: 'Space Types', description: 'Performance stage area' },
  { name: 'Green Room', color: '#059669', emoji: '🚪', category: 'Space Types', description: 'Backstage waiting and preparation area' },
  { name: 'Lobby', color: '#0891B2', emoji: '🏛️', category: 'Space Types', description: 'Entrance or lobby area' },
  { name: 'Storage Room', color: '#A16207', emoji: '📦', category: 'Space Types', description: 'Instrument and equipment storage' },
  { name: 'Office', color: '#475569', emoji: '🏢', category: 'Space Types', description: 'Administrative or instructor office' },
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
