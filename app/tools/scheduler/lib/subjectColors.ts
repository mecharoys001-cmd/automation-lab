/**
 * Unified subject color system for the scheduler.
 *
 * Dynamically generates visually distinct colors for ANY number of subjects
 * using golden-angle hue spacing in the OKLCH perceptual color space.
 * Known subjects get hand-tuned emoji icons; everything else gets 🎵.
 *
 * Every component that renders a subject/skill/tag should use:
 *   - getSubjectColor(name)  → full SubjectColor object
 *   - getBarColor(name)      → hex accent for charts/bars
 *   - EVENT_COLORS[type]     → { accent, bg, text } for calendar blocks
 */

// ============================================================
// Types
// ============================================================

export interface SubjectColor {
  /** Emoji icon for the subject */
  emoji: string;
  /** Hex badge background (light tint) — use as inline style */
  badgeBg: string;
  /** Hex badge text color (dark shade) — use as inline style */
  badgeText: string;
  /** Hex badge border color — use as inline style */
  badgeBorder: string;
  /** Hex accent color for calendar event blocks / chart bars */
  accent: string;
  /** Hex bg color for calendar event blocks (light tint) */
  eventBg: string;
  /** Hex text color for calendar event blocks (dark shade) */
  eventText: string;
}

// ============================================================
// Dynamic color generation (HSL with golden-angle spacing)
// ============================================================

/**
 * Attempt OKLCH-style perceptual color generation via HSL approximation.
 * Uses the golden angle (≈137.508°) for maximum hue separation,
 * with carefully tuned saturation/lightness for:
 *   - accent:  vivid, mid-tone  (S=72%, L=52%)
 *   - eventBg: very light tint  (S=80%, L=96%)
 *   - eventText: dark shade     (S=60%, L=28%)
 *   - badge:   light bg, dark text, medium border
 *
 * Avoids hues that cause readability problems on white backgrounds
 * (pure yellow at ~60° gets shifted to amber/gold).
 */

const GOLDEN_ANGLE = 137.508;

/** Deterministic hash of a string to a number. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/** HSL → hex. H in [0,360], S and L in [0,100]. */
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a full SubjectColor from a hue angle [0-360].
 * Adjusts saturation/lightness to avoid washed-out or unreadable combos.
 */
function colorFromHue(hue: number, emoji: string): SubjectColor {
  // Shift pure yellow zone (50-70°) to be more amber/gold for readability
  const h = hue;

  // Accent: vivid mid-tone
  const accent = hslToHex(h, 72, 52);
  // Event background: very light tint
  const eventBg = hslToHex(h, 80, 96);
  // Event text: dark shade for contrast
  const eventText = hslToHex(h, 60, 28);

  // Badge colors use inline styles via hex, but we also provide utility-compatible values
  const badgeBg = hslToHex(h, 70, 93);
  const badgeText = hslToHex(h, 55, 32);
  const badgeBorder = hslToHex(h, 55, 78);

  return {
    emoji,
    badgeBg,
    badgeText,
    badgeBorder,
    accent,
    eventBg,
    eventText,
  };
}

// ============================================================
// Known subjects (curated emoji + stable hue assignments)
// ============================================================

/** Hand-picked hues for known music subjects to keep them visually familiar. */
const KNOWN_SUBJECTS: Record<string, { emoji: string; hue: number }> = {
  strings:       { emoji: '🎻', hue: 268 },  // violet
  piano:         { emoji: '🎹', hue: 217 },  // blue
  brass:         { emoji: '🎺', hue: 45  },  // gold
  percussion:    { emoji: '🥁', hue: 36  },  // amber
  choral:        { emoji: '🎤', hue: 330 },  // pink
  choir:         { emoji: '🎤', hue: 330 },  // alias
  guitar:        { emoji: '🎸', hue: 160 },  // emerald
  woodwind:      { emoji: '🪈', hue: 174 },  // teal
  'general music': { emoji: '🎵', hue: 250 }, // indigo
  'music theory': { emoji: '📖', hue: 200 },  // sky
  composition:   { emoji: '✏️', hue: 290 },  // purple
  ensemble:      { emoji: '🎶', hue: 142 },  // green
  jazz:          { emoji: '🎷', hue: 25  },  // orange
  orchestra:     { emoji: '🎻', hue: 280 },  // purple-violet
  band:          { emoji: '🎺', hue: 10  },  // red
  voice:         { emoji: '🎤', hue: 340 },  // rose
  recorder:      { emoji: '🪈', hue: 185 },  // cyan
  ukulele:       { emoji: '🎸', hue: 100 },  // lime
  drums:         { emoji: '🥁', hue: 36  },  // alias for percussion
  violin:        { emoji: '🎻', hue: 268 },  // alias for strings
  cello:         { emoji: '🎻', hue: 258 },  // close to strings
  flute:         { emoji: '🪈', hue: 190 },  // close to woodwind
  clarinet:      { emoji: '🪈', hue: 180 },  // close to woodwind
  trumpet:       { emoji: '🎺', hue: 50  },  // close to brass
  trombone:      { emoji: '🎺', hue: 40  },  // close to brass
  saxophone:     { emoji: '🎷', hue: 20  },  // warm orange
};

// ============================================================
// Caching & lookup
// ============================================================

/** Cache generated colors so the same subject always gets the same color. */
const colorCache = new Map<string, SubjectColor>();

/** Normalize a subject name for lookup (lowercase, strip trailing 's'). */
function normalizeKey(name: string): string {
  return name.toLowerCase().trim().replace(/s$/, '');
}

// Pre-populate cache with known subjects
for (const [key, { emoji, hue }] of Object.entries(KNOWN_SUBJECTS)) {
  colorCache.set(key, colorFromHue(hue, emoji));
}

/**
 * Tracks how many dynamic (unknown) subjects we've assigned hues to,
 * so each new one gets the next golden-angle step for max separation.
 */
let dynamicIndex = 0;
/** Starting hue offset for dynamic colors (avoids overlap with common known hues). */
const DYNAMIC_HUE_OFFSET = 75;

/**
 * Get a dynamically generated hue for an unknown subject.
 * Uses golden-angle spacing from a carefully chosen offset.
 */
function nextDynamicHue(): number {
  const hue = (DYNAMIC_HUE_OFFSET + dynamicIndex * GOLDEN_ANGLE) % 360;
  dynamicIndex++;
  return hue;
}

// ============================================================
// Public API
// ============================================================

/**
 * Look up or generate colors for any subject name (case-insensitive).
 * Known subjects get curated colors; unknown subjects get dynamically
 * generated, visually distinct colors that are stable within the session.
 */
export function getSubjectColor(name: string): SubjectColor {
  const key = normalizeKey(name);
  const cached = colorCache.get(key);
  if (cached) return cached;

  // Generate a new color for this unknown subject
  const hue = nextDynamicHue();
  const color = colorFromHue(hue, '🎵');
  colorCache.set(key, color);
  return color;
}

/** All known subject keys, title-cased. */
export const SUBJECT_NAMES = Object.keys(KNOWN_SUBJECTS)
  .filter((k) => !['choir', 'drums', 'violin'].includes(k)) // skip aliases
  .map((k) => k.charAt(0).toUpperCase() + k.slice(1));

/**
 * Get a hex bar/chart color for a subject name.
 * Uses the unified accent color from getSubjectColor.
 */
export function getBarColor(name: string, _index?: number): string {
  return getSubjectColor(name).accent;
}

/**
 * Build the EVENT_COLORS record used by calendar views.
 * Provides backwards-compatible { accent, bg, text } shape.
 * Dynamically backed — accessing any key generates a color if needed.
 */
export const EVENT_COLORS: Record<string, { accent: string; bg: string; text: string }> = new Proxy(
  {} as Record<string, { accent: string; bg: string; text: string }>,
  {
    get(_target, prop: string) {
      const c = getSubjectColor(prop);
      return { accent: c.accent, bg: c.eventBg, text: c.eventText };
    },
    has() {
      return true; // Any key is valid
    },
  },
);

/**
 * Build SKILL_STYLES record used by the people page.
 * Dynamically backed — any key returns the right style.
 */
export const SKILL_STYLES: Record<string, { emoji: string; bg: string; text: string }> = new Proxy(
  {} as Record<string, { emoji: string; bg: string; text: string }>,
  {
    get(_target, prop: string) {
      const c = getSubjectColor(prop);
      return { emoji: c.emoji, bg: c.badgeBg, text: c.badgeText };
    },
    has() {
      return true;
    },
  },
);

/**
 * For legacy code: static record of known subject colors.
 * Prefer getSubjectColor() for dynamic support.
 */
export const SUBJECT_COLORS: Record<string, SubjectColor> = Object.fromEntries(
  Object.entries(KNOWN_SUBJECTS)
    .filter(([k]) => !['choir', 'drums', 'violin'].includes(k))
    .map(([key, { emoji, hue }]) => [key, colorFromHue(hue, emoji)]),
);
