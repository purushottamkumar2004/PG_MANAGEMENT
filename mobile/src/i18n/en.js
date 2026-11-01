// English UI text. Every visible string in the app comes from here.
// Hindi (hi.js) and Marathi (mr.js) arrive in T-15 with the same keys.
const en = {
  'app.name': 'PG Manager',
  'common.loading': 'Loading…',
  'common.logout': 'Logout',

  'login.title': 'Login',
  'login.phone': 'Mobile number',
  'login.phonePlaceholder': '10-digit number',
  'login.password': 'Password',
  'login.button': 'Login',
  'login.devComponents': 'Components (dev only)',

  'validation.phoneRequired': 'Enter your mobile number',
  'validation.phoneInvalid': 'Enter a valid 10-digit mobile number',
  'validation.passwordRequired': 'Enter your password',
  'validation.passwordTooLong': 'Password is too long',

  'error.VALIDATION_ERROR': 'Please check the mobile number and password',
  'error.INVALID_CREDENTIALS': 'Wrong mobile number or password',
  'error.ACCOUNT_INACTIVE': 'This account is switched off. Please contact your owner or support.',
  'error.UNAUTHORIZED': 'Please login again',
  'error.FORBIDDEN': 'You are not allowed to do this',
  'error.NOT_FOUND': 'Not found',
  'error.CONFLICT': 'This was changed by someone else. Please try again.',
  'error.NETWORK_ERROR': 'Cannot reach the server. Check internet and try again.',
  'error.CONFIG_ERROR': 'Server address is not set in the app',
  'error.INTERNAL': 'Something went wrong. Please try again.',

  'home.greeting': 'Hello, {name}',
  'home.admin': 'Admin',
  'home.owner': 'Owner',
  'home.manager': 'Manager',

  'building.free': '{free}/{total} free',
  'building.noPhoto': 'No photo',

  'floor.title': 'Floor {number}',
  'floor.ground': 'Ground floor',
  'floor.free': '{free} free',

  'room.title': 'Room {number}',
  'room.beds': '{count} beds',

  'bed.title': 'Bed {label}',
  'bed.status.vacant': 'Free',
  'bed.status.paid': 'Paid',
  'bed.status.partial': 'Part paid',
  'bed.status.overdue': 'Overdue',
  'bed.status.pending': 'Due',
  'bed.status.unknown': 'Unknown',

  'dev.title': 'Components',
  'dev.buildings': 'Buildings',
  'dev.floors': 'Floors',
  'dev.rooms': 'Rooms',
  'dev.beds': 'Beds',
};

export default en;
