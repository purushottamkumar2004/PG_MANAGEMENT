export const ROLES = ['admin', 'owner', 'manager'];

const HOME_ROUTES = {
  admin: '/admin',
  owner: '/owner',
  manager: '/manager',
};

// Where a logged-in user lands. Unknown role -> null (treated as logged out).
export function homeRouteForRole(role) {
  return HOME_ROUTES[role] || null;
}

export function isKnownRole(role) {
  return ROLES.includes(role);
}
