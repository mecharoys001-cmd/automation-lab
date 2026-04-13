import { describe, it, expect } from 'vitest';
import {
  formatSlotLabel,
  isSlotAvailable,
  buildBlocksFromSlots,
  EDITOR_SLOTS,
} from '../AvailabilityEditor';
import type { TimeBlock } from '@/types/database';

describe('formatSlotLabel', () => {
  it('formats on-the-hour times', () => {
    expect(formatSlotLabel(480)).toBe('8 AM');   // 8:00
    expect(formatSlotLabel(720)).toBe('12 PM');  // 12:00
    expect(formatSlotLabel(780)).toBe('1 PM');   // 13:00
  });

  it('formats half-hour times', () => {
    expect(formatSlotLabel(510)).toBe('8:30');   // 8:30
    expect(formatSlotLabel(750)).toBe('12:30');  // 12:30
    expect(formatSlotLabel(810)).toBe('1:30');   // 13:30
  });
});

describe('EDITOR_SLOTS', () => {
  it('contains 30-minute slots from 8:00 to 19:30', () => {
    expect(EDITOR_SLOTS[0]).toBe(480);             // 8:00 AM
    expect(EDITOR_SLOTS[EDITOR_SLOTS.length - 1]).toBe(1170); // 19:30
    expect(EDITOR_SLOTS.length).toBe(24);          // 24 half-hour slots
    // Check 30-minute spacing
    for (let i = 1; i < EDITOR_SLOTS.length; i++) {
      expect(EDITOR_SLOTS[i] - EDITOR_SLOTS[i - 1]).toBe(30);
    }
  });
});

describe('isSlotAvailable', () => {
  const blocks: TimeBlock[] = [{ start: '09:00', end: '11:00' }];

  it('returns true for a 30-min slot fully inside a block', () => {
    expect(isSlotAvailable(540, blocks)).toBe(true);  // 9:00–9:30
    expect(isSlotAvailable(570, blocks)).toBe(true);  // 9:30–10:00
    expect(isSlotAvailable(600, blocks)).toBe(true);  // 10:00–10:30
    expect(isSlotAvailable(630, blocks)).toBe(true);  // 10:30–11:00
  });

  it('returns false for a 30-min slot fully outside a block', () => {
    expect(isSlotAvailable(480, blocks)).toBe(false); // 8:00–8:30
    expect(isSlotAvailable(510, blocks)).toBe(false); // 8:30–9:00
    expect(isSlotAvailable(660, blocks)).toBe(false); // 11:00–11:30
  });

  it('handles multiple blocks', () => {
    const multi: TimeBlock[] = [
      { start: '08:00', end: '09:00' },
      { start: '14:00', end: '15:30' },
    ];
    expect(isSlotAvailable(480, multi)).toBe(true);   // 8:00–8:30
    expect(isSlotAvailable(510, multi)).toBe(true);   // 8:30–9:00
    expect(isSlotAvailable(540, multi)).toBe(false);  // 9:00–9:30
    expect(isSlotAvailable(840, multi)).toBe(true);   // 14:00–14:30
    expect(isSlotAvailable(870, multi)).toBe(true);   // 14:30–15:00
    expect(isSlotAvailable(900, multi)).toBe(true);   // 15:00–15:30
    expect(isSlotAvailable(930, multi)).toBe(false);  // 15:30–16:00
  });
});

describe('buildBlocksFromSlots', () => {
  it('returns empty array for no slots', () => {
    expect(buildBlocksFromSlots(new Set())).toEqual([]);
  });

  it('creates a single block from one 30-min slot', () => {
    expect(buildBlocksFromSlots(new Set([540]))).toEqual([
      { start: '09:00', end: '09:30' },
    ]);
  });

  it('merges adjacent 30-min slots into one block', () => {
    expect(buildBlocksFromSlots(new Set([540, 570, 600]))).toEqual([
      { start: '09:00', end: '10:30' },
    ]);
  });

  it('keeps non-adjacent slots as separate blocks', () => {
    expect(buildBlocksFromSlots(new Set([480, 510, 600, 630]))).toEqual([
      { start: '08:00', end: '09:00' },
      { start: '10:00', end: '11:00' },
    ]);
  });

  it('produces correct HH:MM format for half-hour boundaries', () => {
    expect(buildBlocksFromSlots(new Set([510]))).toEqual([
      { start: '08:30', end: '09:00' },
    ]);
    expect(buildBlocksFromSlots(new Set([510, 540]))).toEqual([
      { start: '08:30', end: '09:30' },
    ]);
  });
});
