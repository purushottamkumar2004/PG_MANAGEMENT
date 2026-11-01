import { cleanPhone, validateLogin } from '../screens/loginValidation';

describe('validateLogin', () => {
  test('valid phone and password pass', () => {
    expect(validateLogin({ phone: '9000000001', password: 'owner123' })).toEqual({});
  });

  test('empty fields', () => {
    expect(validateLogin({ phone: '', password: '' })).toEqual({
      phone: 'validation.phoneRequired',
      password: 'validation.passwordRequired',
    });
  });

  test.each(['900000000', '90000000011', '5000000001', '0000000000', '90000abc01'])(
    'rejects bad phone %s',
    (phone) => {
      expect(validateLogin({ phone, password: 'x' }).phone).toBe('validation.phoneInvalid');
    }
  );

  test('rejects password over 100 chars', () => {
    expect(validateLogin({ phone: '9000000001', password: 'a'.repeat(101) }).password).toBe(
      'validation.passwordTooLong'
    );
    expect(validateLogin({ phone: '9000000001', password: 'a'.repeat(100) })).toEqual({});
  });
});

describe('cleanPhone', () => {
  test('keeps digits only, max 10', () => {
    expect(cleanPhone('+91 98-765 43210')).toBe('9198765432');
    expect(cleanPhone('98765abc')).toBe('98765');
    expect(cleanPhone(undefined)).toBe('');
  });
});
