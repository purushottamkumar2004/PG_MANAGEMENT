// Season password (T-06, D-01, D-10): one 6-digit code per manager, set by the owner.
// Never log or return the code or its hash.
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { manager } from '../db/schema.js';
import { isUuid } from './uuid.js';
import {
  validationError, notFound, seasonCodeNotSet, seasonCodeWrong, managerLocked,
} from './errors.js';

export const MAX_ATTEMPTS = 3;
const HASH_ROUNDS = 10;
const FORMAT_RE = /^[0-9]{6}$/;
const WEAK_CODES = new Set(['123456', '654321']);

/** Format accepted in a gated action's `season_code`: exactly 6 digits. */
export const isSeasonCodeFormat = (v) => typeof v === 'string' && FORMAT_RE.test(v);

/** Rules for a new code set by the owner: 6 digits, not one repeated digit, not 123456 / 654321. */
export function isAcceptableNewCode(v) {
  if (!isSeasonCodeFormat(v)) return false;
  if (/^(\d)\1{5}$/.test(v)) return false;
  return !WEAK_CODES.has(v);
}

export const hashSeasonCode = (code) => bcrypt.hash(code, HASH_ROUNDS);

/** Attempts the manager still has before the lock. */
export const attemptsLeft = (row) => (row.is_locked ? 0 : Math.max(0, MAX_ATTEMPTS - row.failed_attempts));

/**
 * Verifies a manager's season code before a gated action (check-in, payment, check-out, bed shift).
 * Runs in its own transaction with the manager row locked (SELECT ... FOR UPDATE), so a failed
 * attempt is saved even though the action is refused, and parallel requests are counted one by one.
 * Resolves on success (failed_attempts reset to 0); otherwise throws the contract error:
 *   400 VALIDATION_ERROR (bad format, not counted) · 409 SEASON_CODE_NOT_SET ·
 *   423 MANAGER_LOCKED (already locked, not counted; or 3rd wrong try, attempts_left 0) ·
 *   403 SEASON_CODE_WRONG with attempts_left 2 or 1.
 * Call it before the action's own transaction.
 */
export async function verifySeasonCode(managerId, code) {
  if (!isSeasonCodeFormat(code)) throw validationError('season_code must be exactly 6 digits');
  if (!isUuid(managerId)) throw notFound('Manager not found');

  // The transaction returns the outcome; errors are thrown only after it commits,
  // because throwing inside would roll back the failed-attempt count.
  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx.select({
      id: manager.id,
      current_code_hash: manager.current_code_hash,
      failed_attempts: manager.failed_attempts,
      is_locked: manager.is_locked,
    }).from(manager).where(eq(manager.id, managerId)).for('update');

    if (!row) return { error: notFound('Manager not found') };
    if (!row.current_code_hash) return { error: seasonCodeNotSet() };
    if (row.is_locked) return { error: managerLocked() };

    const ok = await bcrypt.compare(code, row.current_code_hash);
    if (ok) {
      if (row.failed_attempts !== 0) {
        await tx.update(manager).set({ failed_attempts: 0 }).where(eq(manager.id, managerId));
      }
      return { ok: true };
    }

    const failed = Math.min(MAX_ATTEMPTS, row.failed_attempts + 1);
    const locked = failed >= MAX_ATTEMPTS;
    await tx.update(manager).set({ failed_attempts: failed, is_locked: locked }).where(eq(manager.id, managerId));
    return { error: locked ? managerLocked(0) : seasonCodeWrong(MAX_ATTEMPTS - failed) };
  });

  if (outcome.error) throw outcome.error;
}
