// Owner manager settings (T-06): list managers, set a season code, unlock (D-01, D-10).
// The owner can only touch managers of their own buildings; anything else is 404.
import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { manager, building } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validationError, notFound } from '../lib/errors.js';
import { isUuid } from '../lib/uuid.js';
import { isAcceptableNewCode, hashSeasonCode } from '../lib/seasonCode.js';

// Whitelisted columns: the hash itself is never selected, only whether it exists.
const managerFields = {
  id: manager.id,
  name: manager.name,
  phone: manager.phone,
  building_id: manager.building_id,
  building_name: building.name,
  is_active: manager.is_active,
  current_code_hash: manager.current_code_hash,
  code_updated_at: manager.code_updated_at,
  is_locked: manager.is_locked,
  failed_attempts: manager.failed_attempts,
};

const toManager = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  building_id: row.building_id,
  building_name: row.building_name,
  is_active: row.is_active,
  has_season_code: row.current_code_hash != null,
  code_updated_at: row.code_updated_at ? row.code_updated_at.toISOString() : null,
  is_locked: row.is_locked,
  failed_attempts: row.failed_attempts,
});

// Both manager and building must belong to the owner (the DB also keeps them consistent).
const ownedBy = (ownerId) => and(eq(manager.owner_id, ownerId), eq(building.owner_id, ownerId));

const selectManagers = (where) => db.select(managerFields).from(manager)
  .innerJoin(building, eq(building.id, manager.building_id)).where(where);

async function loadOwnedManager(ownerId, managerId) {
  if (!isUuid(managerId)) throw notFound('Manager not found');
  const [row] = await selectManagers(and(ownedBy(ownerId), eq(manager.id, managerId))).limit(1);
  if (!row) throw notFound('Manager not found');
  return row;
}

const codeSchema = z.object({
  code: z.string().refine(isAcceptableNewCode, {
    message: 'code must be 6 digits, not one repeated digit, not 123456 or 654321',
  }),
});

export const ownerRouter = Router();
ownerRouter.use(requireAuth, requireRole('owner'));

ownerRouter.get('/managers', async (req, res, next) => {
  try {
    const rows = await selectManagers(ownedBy(req.user.owner_id))
      .orderBy(asc(building.name), asc(manager.name));
    res.json({ managers: rows.map(toManager) });
  } catch (err) {
    next(err);
  }
});

ownerRouter.put('/managers/:managerId/season-code', async (req, res, next) => {
  try {
    const current = await loadOwnedManager(req.user.owner_id, req.params.managerId);
    const parsed = codeSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw validationError(parsed.error.issues[0]?.message ?? 'Invalid input');

    const hash = await hashSeasonCode(parsed.data.code);
    await db.update(manager)
      .set({ current_code_hash: hash, code_updated_at: new Date(), failed_attempts: 0, is_locked: false })
      .where(eq(manager.id, current.id));
    res.json({ manager: toManager(await loadOwnedManager(req.user.owner_id, current.id)) });
  } catch (err) {
    next(err);
  }
});

ownerRouter.post('/managers/:managerId/unlock', async (req, res, next) => {
  try {
    const current = await loadOwnedManager(req.user.owner_id, req.params.managerId);
    await db.update(manager).set({ failed_attempts: 0, is_locked: false }).where(eq(manager.id, current.id));
    res.json({ manager: toManager(await loadOwnedManager(req.user.owner_id, current.id)) });
  } catch (err) {
    next(err);
  }
});
