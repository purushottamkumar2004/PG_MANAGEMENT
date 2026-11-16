// Natural order for room numbers: "2" before "10", "G1" before "G10".
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export const naturalCompare = (a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
