import { describe, it, expect } from 'vitest';

/**
 * Regression: native select caret overlaps text when `appearance-none` and
 * right padding are missing. Every scheduler select class must hide the native
 * arrow and reserve enough padding so custom / fallback carets never overlap.
 */

// Import the shared select class constant(s) used on the Role Management page.
import { schedulerSelectClass } from './select-styles';

describe('Scheduler select styling', () => {
  it('hides the native dropdown arrow via appearance-none', () => {
    expect(schedulerSelectClass).toMatch(/\bappearance-none\b/);
  });

  it('reserves right padding (pr-8 or greater) so text cannot overlap the caret area', () => {
    // pr-8 = 2rem = 32px — standard minimum for caret clearance
    const prMatch = schedulerSelectClass.match(/\bpr-(\d+)\b/);
    expect(prMatch).not.toBeNull();
    expect(Number(prMatch![1])).toBeGreaterThanOrEqual(8);
  });
});
