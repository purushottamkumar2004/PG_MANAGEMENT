// Manager self-service (T-06): season password status, so the app can warn before a gated form.
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { manager } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { attemptsLeft } from '../lib/seasonCode.js';

export const managerRouter = Router();
managerRouter.use(requireAuth, requireRole('manager'));

managerRouter.get('/status', async (req, res, next) => {
  try {
    const [row] = await db.select({
      current_code_hash: manager.current_code_hash,
      failed_attempts: manager.failed_attempts,
      is_locked: manager.is_locked,
    }).from(manager).where(eq(manager.id, req.user.id)).limit(1);
    if (!row) throw notFound('Manager not found');
    res.json({
      has_season_code: row.current_code_hash != null,
      is_locked: row.is_locked,
      attempts_left: attemptsLeft(row),
    });
  } catch (err) {
    next(err);
  }
});
