// requireAuth: verifies the JWT and re-loads the user from the DB on every request,
// so a switched-off owner (and their managers) is blocked even with an old token.
import { verifyToken } from '../lib/jwt.js';
import { findAccountById } from '../lib/users.js';
import { isUuid } from '../lib/uuid.js';
import { unauthorized, accountInactive, forbidden } from '../lib/errors.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/.exec(header);
    if (!match) throw unauthorized();

    const claims = verifyToken(match[1]);
    if (!claims || !isUuid(claims.sub)) throw unauthorized('Invalid or expired token');

    const account = await findAccountById(claims.role, claims.sub);
    if (!account) throw unauthorized('Invalid or expired token');
    if (!account.active) throw accountInactive();

    const { id, role, owner_id, building_id, name } = account.user;
    req.user = { id, role, owner_id, building_id };
    req.userProfile = { id, name, role, owner_id, building_id };
    next();
  } catch (err) {
    next(err);
  }
}

/** Use after requireAuth. Wrong role -> 403 FORBIDDEN. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};
