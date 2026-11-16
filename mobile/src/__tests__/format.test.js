import { floorTitle, formatDate, formatMonth, formatRupees, maskAadhaar, placeText, telUrl } from '../format';

test('rupees use Indian grouping', () => {
  expect(formatRupees(0)).toBe('₹0');
  expect(formatRupees(999)).toBe('₹999');
  expect(formatRupees(7000)).toBe('₹7,000');
  expect(formatRupees(125000)).toBe('₹1,25,000');
  expect(formatRupees(12345678)).toBe('₹1,23,45,678');
  expect(formatRupees(null)).toBe('—');
});

test('Aadhaar is always masked to the last 4 digits', () => {
  expect(maskAadhaar('1234')).toBe('XXXX-XXXX-1234');
  expect(maskAadhaar(null)).toBe('—');
  expect(maskAadhaar('12345')).toBe('—');
});

test('dates and months', () => {
  expect(formatDate('2026-11-02')).toBe('02 Nov 2026');
  expect(formatDate(null)).toBe('—');
  expect(formatMonth('2026-01')).toBe('Jan 2026');
});

test('tel link keeps digits only', () => {
  expect(telUrl('9876500002')).toBe('tel:9876500002');
  expect(telUrl('')).toBeNull();
});

test('place text and floor titles', () => {
  expect(floorTitle(0)).toBe('Ground floor');
  expect(floorTitle(2)).toBe('Floor 2');
  expect(placeText(['Shanti PG', 'Floor 1', null, 'Room 101'])).toBe('Shanti PG › Floor 1 › Room 101');
  expect(placeText([undefined, 'Floor 1'])).toBe('Floor 1');
});
