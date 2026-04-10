const LOCKED_TAG_CATEGORY_ALIASES = new Map<string, string>([
  ['event type', 'Event Type'],
  ['event types', 'Event Type'],
  ['subject', 'Event Type'],
  ['subjects', 'Event Type'],
  ['space type', 'Space Types'],
  ['space types', 'Space Types'],
  ['spaces type', 'Space Types'],
]);

export const LOCKED_TAG_CATEGORIES = ['Event Type', 'Space Types'] as const;

export function normalizeTagCategory(category: string | null | undefined): string {
  const trimmed = category?.trim();
  if (!trimmed) return 'General';

  const normalized = LOCKED_TAG_CATEGORY_ALIASES.get(trimmed.toLowerCase());
  return normalized ?? trimmed;
}

export function isLockedTagCategory(category: string | null | undefined): boolean {
  const normalized = normalizeTagCategory(category);
  return LOCKED_TAG_CATEGORIES.includes(normalized as (typeof LOCKED_TAG_CATEGORIES)[number]);
}

export function getLockedTagReason(category: string | null | undefined): string {
  const normalized = normalizeTagCategory(category);
  if (normalized === 'Event Type') {
    return 'Locked because Event Type tags are tied to core scheduler fields.';
  }

  if (normalized === 'Space Types') {
    return 'Locked because Space Type tags are tied to core scheduler fields.';
  }

  return 'Locked because this tag is tied to a core scheduler field.';
}
