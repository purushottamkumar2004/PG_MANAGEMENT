// Client-side checks that mirror docs/API_CONTRACT.md "Admin setup" validation.
// They only save a round trip; the backend validates everything again.
// Each function returns { field: i18nKey } for the fields that are wrong.

export const digitsOnly = (text) => String(text || '').replace(/[^0-9]/g, '');

const PHONE_RE = /^[6-9][0-9]{9}$/;

function checkName(value, errors) {
  const v = String(value || '').trim();
  if (v.length < 1 || v.length > 100) errors.name = 'admin.validation.name';
}

function checkPhone(value, errors) {
  if (!PHONE_RE.test(String(value || ''))) errors.phone = 'validation.phoneInvalid';
}

function checkPassword(value, errors) {
  const v = String(value || '');
  if (v.length < 6 || v.length > 100) errors.password = 'admin.validation.password';
}

export function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// Owner and manager forms. On edit, an empty password means "keep the old one".
export function validatePerson({ name, phone, password }, { passwordOptional = false } = {}) {
  const errors = {};
  checkName(name, errors);
  checkPhone(phone, errors);
  if (!(passwordOptional && !password)) checkPassword(password, errors);
  return errors;
}

export function validateBuilding({ name, address, photoUrl }) {
  const errors = {};
  checkName(name, errors);
  if (String(address || '').trim().length > 200) errors.address = 'admin.validation.address';
  const url = String(photoUrl || '').trim();
  if (url && (url.length > 500 || !isHttpsUrl(url))) errors.photoUrl = 'admin.validation.photoUrl';
  return errors;
}

export function validateFloorNumber(text) {
  const errors = {};
  const s = String(text || '');
  const n = Number(s);
  if (!/^[0-9]{1,3}$/.test(s) || n > 200) errors.floorNumber = 'admin.validation.floorNumber';
  return errors;
}

export function validateRoom({ roomNumber, bedCapacity }) {
  const errors = {};
  const v = String(roomNumber || '').trim();
  if (v.length < 1 || v.length > 10) errors.roomNumber = 'admin.validation.roomNumber';
  if (bedCapacity !== 2 && bedCapacity !== 3) errors.bedCapacity = 'admin.validation.bedCapacity';
  return errors;
}
