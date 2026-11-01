import { colors } from '../theme';

// SPEC section 4: green vacant, blue paid, yellow partial, red overdue,
// pending (not yet overdue) = blue outline. Each state also has a symbol and
// a word so colour is never the only signal.
export const BED_STATUS = {
  vacant: { background: colors.vacant, border: colors.vacant, text: '#FFFFFF', symbol: '+', labelKey: 'bed.status.vacant' },
  paid: { background: colors.paid, border: colors.paid, text: '#FFFFFF', symbol: '✓', labelKey: 'bed.status.paid' },
  partial: { background: colors.partial, border: colors.partial, text: '#111827', symbol: '½', labelKey: 'bed.status.partial' },
  overdue: { background: colors.overdue, border: colors.overdue, text: '#FFFFFF', symbol: '!', labelKey: 'bed.status.overdue' },
  pending: { background: '#FFFFFF', border: colors.paid, text: colors.paid, symbol: '⏳', labelKey: 'bed.status.pending' },
};

const UNKNOWN = { background: colors.surface, border: colors.unknown, text: colors.unknown, symbol: '?', labelKey: 'bed.status.unknown' };

export const BED_STATUS_LIST = Object.keys(BED_STATUS);

export function bedStatusStyle(status) {
  return BED_STATUS[status] || UNKNOWN;
}
