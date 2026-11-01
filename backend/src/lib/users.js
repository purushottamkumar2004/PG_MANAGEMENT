// Loads login accounts. Owner and building always come from the DB, never from a token.
// Only whitelisted fields leave this module: hashes are never part of a returned user.
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { admin, owner, manager } from '../db/schema.js';

const managerColumns = {
  id: manager.id, name: manager.name, owner_id: manager.owner_id, building_id: manager.building_id,
  password_hash: manager.password_hash, is_active: manager.is_active, owner_is_active: owner.is_active,
};

/** Public user shape from the contract. */
function toUser(role, row) {
  if (role === 'admin') return { id: row.id, name: row.name, role, owner_id: null, building_id: null };
  if (role === 'owner') return { id: row.id, name: row.name, role, owner_id: row.id, building_id: null };
  return { id: row.id, name: row.name, role, owner_id: row.owner_id, building_id: row.building_id };
}

function isActive(role, row) {
  if (role === 'admin') return true;
  if (role === 'owner') return row.is_active;
  return row.is_active && row.owner_is_active; // manager is blocked when its owner is switched off
}

const finders = {
  admin: (col, v) => db.select({ id: admin.id, name: admin.name, password_hash: admin.password_hash })
    .from(admin).where(eq(col.admin, v)).limit(1),
  owner: (col, v) => db.select({ id: owner.id, name: owner.name, password_hash: owner.password_hash, is_active: owner.is_active })
    .from(owner).where(eq(col.owner, v)).limit(1),
  manager: (col, v) => db.select(managerColumns)
    .from(manager).innerJoin(owner, eq(owner.id, manager.owner_id)).where(eq(col.manager, v)).limit(1),
};

const PHONE = { admin: admin.phone, owner: owner.phone, manager: manager.phone };
const ID = { admin: admin.id, owner: owner.id, manager: manager.id };
export const ROLES = Object.freeze(['admin', 'owner', 'manager']);

/** Finds an account by phone. Lookup order per contract: admin, owner, manager. */
export async function findAccountByPhone(phone) {
  for (const role of ROLES) {
    const [row] = await finders[role](PHONE, phone);
    if (row) return { role, passwordHash: row.password_hash, active: isActive(role, row), user: toUser(role, row) };
  }
  return null;
}

/** Loads an account by id for a known role. Returns null when it no longer exists. */
export async function findAccountById(role, id) {
  if (!ROLES.includes(role)) return null;
  const [row] = await finders[role](ID, id);
  if (!row) return null;
  return { role, active: isActive(role, row), user: toUser(role, row) };
}
