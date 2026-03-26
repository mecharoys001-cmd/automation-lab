/**
 * Bug Taxonomy - Categorizes bugs by how they should be handled
 */

export const BUG_CATEGORIES = {
  ALREADY_FIXED: [
    'recyHBQr4mshvAMON', // Intake form feedback (toasts + success page exist)
    'recd54cuIBueuGgxa', // Active template validation (fields are optional)
    'recR4nEGyvZ9MWjkK', // Version overwrite warning (modal exists)
    'recHUg2YPxcsNIQO6', // Version overwrite (duplicate of above)
    'recA39Nz2IolzR7Yk', // Max-length (inputs already have maxLength)
    'recSd7hEZNbd4mnXq', // Lazy loading (images already have loading="lazy" or use Next.js Image)
  ],
  
  ARCHITECTURAL: [
    'recOM4KV2NfAQOWjh', // 4-tier role system (needs DB migration)
    'recWOb2YnrFANDR5S', // Server-side enforcement (needs middleware)
  ],
  
  NON_EXISTENT_FEATURE: [
    'recFDhl2DJiKP9pnb', // Week view responsiveness (week view doesn't exist)
  ],
  
  WONT_FIX: [
    'rec1kMRyvMAocMeot', // Bundle size optimization (362KB is acceptable)
  ],
  
  AUTO_FIXABLE: [
    // None remaining - simple fixes are already implemented
  ],
  
  NEEDS_CLAUDE_CODE: [
    'reckX8r6pB9h8WPvj', // Duplicate name detection (server-side validation)
    'reccATuSBzAZvjtg4', // ARIA live regions (complex semantic changes)
    'recT5xo7JRq8YlaCW', // Security review items
  ],
};

export function categorizeBug(bugId: string): string {
  for (const [category, bugs] of Object.entries(BUG_CATEGORIES)) {
    if (bugs.includes(bugId)) return category;
  }
  return 'UNCATEGORIZED';
}

export function shouldSkip(bugId: string): boolean {
  return [
    ...BUG_CATEGORIES.ALREADY_FIXED,
    ...BUG_CATEGORIES.ARCHITECTURAL,
    ...BUG_CATEGORIES.NON_EXISTENT_FEATURE,
    ...BUG_CATEGORIES.WONT_FIX,
  ].includes(bugId);
}

export function canAutoFix(bugId: string): boolean {
  return BUG_CATEGORIES.AUTO_FIXABLE.includes(bugId);
}

export function needsClaudeCode(bugId: string): boolean {
  return BUG_CATEGORIES.NEEDS_CLAUDE_CODE.includes(bugId);
}
