import en from '../i18n/en';
import { errorText, t } from '../i18n';

test('interpolates params', () => {
  expect(t('home.greeting', { name: 'Ravi' })).toBe('Hello, Ravi');
  expect(t('building.free', { free: 0, total: 12 })).toBe('0/12 free');
});

test('unknown key returns the key', () => {
  expect(t('nope.missing')).toBe('nope.missing');
});

test('every contract error code has English text', () => {
  [
    'VALIDATION_ERROR',
    'INVALID_CREDENTIALS',
    'ACCOUNT_INACTIVE',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'INTERNAL',
  ].forEach((code) => expect(en[`error.${code}`]).toBeTruthy());
});

test('unknown error code falls back to the generic message', () => {
  expect(errorText('SOMETHING_NEW')).toBe(en['error.INTERNAL']);
  expect(errorText(undefined)).toBe(en['error.INTERNAL']);
});
