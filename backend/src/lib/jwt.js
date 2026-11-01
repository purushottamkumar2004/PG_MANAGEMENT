import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const ALG = 'HS256';

/** Token carries only { sub, role }. */
export const signToken = (user) =>
  jwt.sign({ role: user.role }, config.jwtSecret, { subject: user.id, algorithm: ALG, expiresIn: config.jwtExpiresIn });

/** Returns { sub, role } or null for any missing, bad or expired token. */
export function verifyToken(token) {
  try {
    const p = jwt.verify(token, config.jwtSecret, { algorithms: [ALG] });
    if (typeof p !== 'object' || typeof p.sub !== 'string' || typeof p.role !== 'string') return null;
    return { sub: p.sub, role: p.role };
  } catch {
    return null;
  }
}
