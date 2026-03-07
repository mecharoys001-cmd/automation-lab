/**
 * Unified subject color system for the scheduler.
 *
 * Every component that renders a subject/skill/tag should pull colors from here
 * instead of defining its own mapping.
 */

export interface SubjectColor {
  /** Emoji icon for the subject */
  emoji: string;
  /** Tailwind bg class for light badge backgrounds */
  badgeBg: string;
  /** Tailwind text class for badge text */
  badgeText: string;
  /** Tailwind border class for badges */
  badgeBorder: string;
  /** Hex accent color for calendar event blocks */
  accent: string;
  /** Hex bg color for calendar event blocks */
  eventBg: string;
  /** Hex text color for calendar event blocks */
  eventText: string;
}

export const SUBJECT_COLORS: Record<string, SubjectColor> = {
  percussion: {
    emoji: '\u{1F941}',       // 🥁
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    accent: '#F59E0B',
    eventBg: '#FFFBEB',
    eventText: '#92400E',
  },
  strings: {
    emoji: '\u{1F3BB}',       // 🎻
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    badgeBorder: 'border-violet-300',
    accent: '#8B5CF6',
    eventBg: '#F5F3FF',
    eventText: '#5B21B6',
  },
  brass: {
    emoji: '\u{1F3BA}',       // 🎺
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-800',
    badgeBorder: 'border-yellow-300',
    accent: '#EAB308',
    eventBg: '#FEFCE8',
    eventText: '#854D0E',
  },
  choral: {
    emoji: '\u{1F3A4}',       // 🎤
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-700',
    badgeBorder: 'border-pink-300',
    accent: '#EC4899',
    eventBg: '#FDF2F8',
    eventText: '#9D174D',
  },
  piano: {
    emoji: '\u{1F3B9}',       // 🎹
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-300',
    accent: '#3B82F6',
    eventBg: '#EFF6FF',
    eventText: '#1E40AF',
  },
  guitar: {
    emoji: '\u{1F3B8}',       // 🎸
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    accent: '#10B981',
    eventBg: '#ECFDF5',
    eventText: '#065F46',
  },
  woodwind: {
    emoji: '\u{1FA88}',       // 🪈
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-300',
    accent: '#14B8A6',
    eventBg: '#F0FDFA',
    eventText: '#115E59',
  },
};

const DEFAULT_COLOR: SubjectColor = {
  emoji: '\u{1F3B5}',         // 🎵
  badgeBg: 'bg-slate-100',
  badgeText: 'text-slate-700',
  badgeBorder: 'border-slate-300',
  accent: '#64748B',
  eventBg: '#F8FAFC',
  eventText: '#334155',
};

/**
 * Look up colors for a subject name (case-insensitive).
 * Falls back to neutral slate if unrecognised.
 */
export function getSubjectColor(name: string): SubjectColor {
  const key = name.toLowerCase().replace(/s$/, ''); // normalise plurals like "woodwinds"
  return SUBJECT_COLORS[key] ?? DEFAULT_COLOR;
}

/** All known subject keys, title-cased. */
export const SUBJECT_NAMES = Object.keys(SUBJECT_COLORS).map(
  (k) => k.charAt(0).toUpperCase() + k.slice(1),
);

/**
 * Build the EVENT_COLORS record used by calendar views.
 * Provides backwards-compatible { accent, bg, text } shape.
 */
export const EVENT_COLORS: Record<string, { accent: string; bg: string; text: string }> = Object.fromEntries(
  Object.entries(SUBJECT_COLORS).map(([key, c]) => [
    key,
    { accent: c.accent, bg: c.eventBg, text: c.eventText },
  ]),
);

/**
 * Get a hex bar/chart color for a subject name.
 * Falls back to a deterministic color from a cycle for unknown subjects.
 */
const BAR_FALLBACK_CYCLE = [
  '#64748B', '#6366F1', '#F97316', '#EC4899',
  '#06B6D4', '#84CC16', '#A855F7', '#EF4444',
];

export function getBarColor(name: string, index?: number): string {
  const key = name.toLowerCase().replace(/s$/, '');
  const entry = SUBJECT_COLORS[key];
  if (entry) return entry.accent;
  // Deterministic fallback based on index or string hash
  if (index !== undefined) return BAR_FALLBACK_CYCLE[index % BAR_FALLBACK_CYCLE.length];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return BAR_FALLBACK_CYCLE[Math.abs(hash) % BAR_FALLBACK_CYCLE.length];
}

/**
 * Build SKILL_STYLES record used by the people page.
 * Provides backwards-compatible { emoji, bg, text } shape with title-cased keys.
 */
export const SKILL_STYLES: Record<string, { emoji: string; bg: string; text: string }> = Object.fromEntries(
  Object.entries(SUBJECT_COLORS).map(([key, c]) => [
    key.charAt(0).toUpperCase() + key.slice(1),
    { emoji: c.emoji, bg: c.badgeBg, text: c.badgeText },
  ]),
);
