import { describe, it, expect } from 'vitest';
import { todayIST, currentMonthIST, addMonths } from '../src/lib/dates.js';

describe('India dates', () => {
  it('uses India time even when UTC is still the previous day', () => {
    const d = new Date('2026-10-31T20:00:00Z'); // 01:30 on 1 Nov in India
    expect(todayIST(d)).toBe('2026-11-01');
    expect(currentMonthIST(d)).toBe('2026-11');
  });
  it('adds and subtracts months across years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
});
