// Bed colour status (API contract "Structure read"). Computed, never stored.
// Pure function: the caller passes India-time "today" and the current month's payment status.

export const BED_STATUSES = Object.freeze(['vacant', 'paid', 'partial', 'pending', 'overdue']);
const PAYMENT_STATUSES = new Set(['pending', 'partial', 'paid']);
const DUE_DAY = 5; // rent is due on the 5th (locked rule 5)

/**
 * @param {object} p
 * @param {boolean} p.hasTenant      bed has an active tenant
 * @param {string|null} p.paymentStatus  current-month row status ('pending'|'partial'|'paid'), null if no row yet
 * @param {string} p.today           India date 'YYYY-MM-DD'
 * @returns {'vacant'|'paid'|'partial'|'pending'|'overdue'}
 */
export function bedStatus({ hasTenant, paymentStatus = null, today }) {
  if (!hasTenant) return 'vacant';
  if (paymentStatus !== null && !PAYMENT_STATUSES.has(paymentStatus)) {
    throw new TypeError(`Unknown payment status: ${paymentStatus}`);
  }
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new TypeError('today must be YYYY-MM-DD');
  }
  if (paymentStatus === 'paid') return 'paid';
  if (Number(today.slice(8, 10)) > DUE_DAY) return 'overdue';
  return paymentStatus === 'partial' ? 'partial' : 'pending';
}
