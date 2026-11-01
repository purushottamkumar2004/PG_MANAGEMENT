// Owner/building scoping used by every data endpoint (locked rule 13).
// Failures are 404 NOT_FOUND, never 403, so other owners' ids are not revealed.
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { building } from '../db/schema.js';
import { notFound } from './errors.js';
import { isUuid } from './uuid.js';

/**
 * Ensures `user` (req.user) may see `buildingId`. Returns { id, owner_id } of the building.
 * admin: any existing building. owner: building.owner_id must equal user.owner_id.
 * manager: buildingId must equal user.building_id.
 */
export async function assertBuildingAccess(user, buildingId, executor = db) {
  if (!user || !isUuid(buildingId)) throw notFound('Building not found');
  if (user.role === 'manager' && buildingId !== user.building_id) throw notFound('Building not found');

  const [row] = await executor.select({ id: building.id, owner_id: building.owner_id })
    .from(building).where(eq(building.id, buildingId)).limit(1);
  if (!row) throw notFound('Building not found');

  if (user.role === 'admin') return row;
  if (user.role === 'owner' && row.owner_id === user.owner_id) return row;
  if (user.role === 'manager' && row.owner_id === user.owner_id) return row;
  throw notFound('Building not found');
}
