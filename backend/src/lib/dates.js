// All business dates are in India time (Asia/Kolkata), whatever the server timezone is.
const TZ = 'Asia/Kolkata';

/** Today's date in India as 'YYYY-MM-DD'. */
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Current rent month in India as 'YYYY-MM'. */
export function currentMonthIST(now = new Date()) {
  return todayIST(now).slice(0, 7);
}

/** Shift a 'YYYY-MM' month by n months (negative goes back). */
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
