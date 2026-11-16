import { describe, it, expect } from 'vitest';
import { bedStatus, BED_STATUSES } from '../src/lib/bedStatus.js';

const at = (day) => `2026-11-${String(day).padStart(2, '0')}`;

describe('bedStatus (contract table)', () => {
  it('no active tenant -> vacant, whatever the day or payment', () => {
    expect(bedStatus({ hasTenant: false, paymentStatus: null, today: at(1) })).toBe('vacant');
    expect(bedStatus({ hasTenant: false, paymentStatus: null, today: at(28) })).toBe('vacant');
    expect(bedStatus({ hasTenant: false, today: at(10) })).toBe('vacant');
  });

  it('paid -> paid on any day', () => {
    for (const d of [1, 5, 6, 30]) expect(bedStatus({ hasTenant: true, paymentStatus: 'paid', today: at(d) })).toBe('paid');
  });

  it('partial: day <= 5 -> partial, day 6 -> overdue', () => {
    expect(bedStatus({ hasTenant: true, paymentStatus: 'partial', today: at(1) })).toBe('partial');
    expect(bedStatus({ hasTenant: true, paymentStatus: 'partial', today: at(5) })).toBe('partial');
    expect(bedStatus({ hasTenant: true, paymentStatus: 'partial', today: at(6) })).toBe('overdue');
    expect(bedStatus({ hasTenant: true, paymentStatus: 'partial', today: '2026-12-31' })).toBe('overdue');
  });

  it('pending: day <= 5 -> pending, day 6 -> overdue', () => {
    expect(bedStatus({ hasTenant: true, paymentStatus: 'pending', today: at(5) })).toBe('pending');
    expect(bedStatus({ hasTenant: true, paymentStatus: 'pending', today: at(6) })).toBe('overdue');
  });

  it('no current-month row yet: day <= 5 -> pending, day 6 -> overdue', () => {
    expect(bedStatus({ hasTenant: true, paymentStatus: null, today: at(1) })).toBe('pending');
    expect(bedStatus({ hasTenant: true, paymentStatus: null, today: at(5) })).toBe('pending');
    expect(bedStatus({ hasTenant: true, paymentStatus: null, today: at(6) })).toBe('overdue');
  });

  it('only returns contract statuses', () => {
    expect(BED_STATUSES).toEqual(['vacant', 'paid', 'partial', 'pending', 'overdue']);
  });

  it('rejects an unknown payment status or a bad date', () => {
    expect(() => bedStatus({ hasTenant: true, paymentStatus: 'done', today: at(1) })).toThrow(TypeError);
    expect(() => bedStatus({ hasTenant: true, paymentStatus: 'paid', today: '5/11/2026' })).toThrow(TypeError);
    expect(() => bedStatus({ hasTenant: true, paymentStatus: null })).toThrow(TypeError);
  });
});
