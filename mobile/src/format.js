import { t } from './i18n';

// Display helpers only. The app never computes money or status; it formats what
// the API returns.

// 1234567 -> "₹12,34,567" (Indian digit grouping). Integers only (rupees).
export function formatRupees(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return t('common.none');
  const negative = amount < 0;
  const digits = String(Math.trunc(Math.abs(amount)));
  let grouped = digits;
  if (digits.length > 3) {
    const head = digits.slice(0, -3);
    const tail = digits.slice(-3);
    grouped = `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
  }
  return `${negative ? '-' : ''}₹${grouped}`;
}

// "2026-11-02" -> "02 Nov 2026". Anything else is shown as given.
export function formatDate(value) {
  if (!value) return t('common.none');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return String(value);
  return `${m[3]} ${t(`month.${m[2]}`)} ${m[1]}`;
}

// "2026-11" -> "Nov 2026"
export function formatMonth(value) {
  if (!value) return t('common.none');
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return String(value);
  return `${t(`month.${m[2]}`)} ${m[1]}`;
}

// Only the last 4 digits are ever stored (rule 10). "1234" -> "XXXX-XXXX-1234".
export function maskAadhaar(last4) {
  if (!last4 || !/^\d{4}$/.test(String(last4))) return t('common.none');
  return `XXXX-XXXX-${last4}`;
}

export function telUrl(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}

export function floorTitle(floorNumber) {
  if (floorNumber === null || floorNumber === undefined) return null;
  return floorNumber === 0 ? t('floor.ground') : t('floor.title', { number: floorNumber });
}

// ["Shanti PG", "Floor 1", null, "Room 101"] -> "Shanti PG › Floor 1 › Room 101"
export function placeText(parts) {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(t('common.placeSeparator'));
}
