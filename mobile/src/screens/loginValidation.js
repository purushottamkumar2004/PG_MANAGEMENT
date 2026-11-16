// Same rules as POST /api/auth/login in docs/API_CONTRACT.md.
export const PHONE_PATTERN = /^[6-9]\d{9}$/;

export function cleanPhone(text) {
  return String(text || '').replace(/\D/g, '').slice(0, 10);
}

// Returns i18n keys per field; empty object means valid.
export function validateLogin({ phone, password }) {
  const errors = {};
  if (!phone) errors.phone = 'validation.phoneRequired';
  else if (!PHONE_PATTERN.test(phone)) errors.phone = 'validation.phoneInvalid';

  if (!password) errors.password = 'validation.passwordRequired';
  else if (password.length > 100) errors.password = 'validation.passwordTooLong';
  return errors;
}
