const LOCKED_TAG_CATEGORY_ALIASES = new Map<string, string>([
  ['event type', 'Event Type'],
  ['event types', 'Event Type'],
  ['subject', 'Event Type'],
  ['subjects', 'Event Type'],
  ['space type', 'Space Types'],
  ['space types', 'Space Types'],
  ['spaces type', 'Space Types'],
  ['staff type', 'Staff Type'],
  ['staff types', 'Staff Type'],
]);

export const LOCKED_TAG_CATEGORIES = ['Event Type', 'Space Types', 'Staff Type'] as const;

export function normalizeTagCategory(category: string | null | undefined): string {
  const trimmed = category?.trim();
  if (!trimmed) return 'General';

  const normalized = LOCKED_TAG_CATEGORY_ALIASES.get(trimmed.toLowerCase());
  return normalized ?? trimmed;
}

/**
 * Returns true if the given category NAME is protected and cannot be renamed or deleted.
 * Individual tags within these categories CAN still be edited/deleted.
 */
export function isLockedTagCategory(category: string | null | undefined): boolean {
  const normalized = normalizeTagCategory(category);
  return LOCKED_TAG_CATEGORIES.includes(normalized as (typeof LOCKED_TAG_CATEGORIES)[number]);
}

export function getLockedCategoryReason(category: string | null | undefined): string {
  const normalized = normalizeTagCategory(category);
  if (normalized === 'Event Type') {
    return 'The "Event Type" category name is protected and cannot be renamed or deleted.';
  }

  if (normalized === 'Space Types') {
    return 'The "Space Types" category name is protected and cannot be renamed or deleted.';
  }

  if (normalized === 'Staff Type') {
    return 'The "Staff Type" category name is protected and cannot be renamed or deleted.';
  }

  return 'This category name is protected and cannot be renamed or deleted.';
}
