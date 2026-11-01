import { expect } from 'vitest';
import { db, pool } from '../src/db/index.js';
import { owner, manager, tenant } from '../src/db/schema.js';
import { createBuildingStructure } from '../src/db/structure.js';

const TABLES = 'transaction_log, payment, tenant, manager, bed, room, floor, building, owner, admin';

export async function truncateAll() {
  await pool.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
}

let phoneSeq = 0;
export const nextPhone = () => `9${String(100000000 + ++phoneSeq).slice(-9)}`;

/** Owner + building (1 floor, one 3-bed room, one 2-bed room) + manager. */
export async function makeBuilding(ownerRow) {
  const o = ownerRow ?? (await db.insert(owner).values({ name: 'O', phone: nextPhone(), password_hash: 'x' }).returning())[0];
  const s = await createBuildingStructure(db, {
    owner_id: o.id, name: 'B',
    floors: [{ number: 1, rooms: [{ number: '101', capacity: 3 }, { number: '102', capacity: 2 }] }],
  });
  const [m] = await db.insert(manager).values({
    owner_id: o.id, building_id: s.building.id, name: 'M', phone: nextPhone(), password_hash: 'x',
  }).returning();
  return { owner: o, building: s.building, beds: s.beds, manager: m };
}

export async function makeTenant(ctx, bedRow, extra = {}) {
  const [t] = await db.insert(tenant).values({
    building_id: ctx.building.id, bed_id: bedRow.id, created_by_manager_id: ctx.manager.id,
    name: 'T', phone: nextPhone(), monthly_rent: 7000, deposit: 7000, start_date: '2026-11-01', ...extra,
  }).returning();
  return t;
}

/** Asserts the promise fails with a Postgres error naming `match` (constraint name or message part). */
export async function expectDbError(promise, match) {
  let err;
  try { await promise; } catch (e) { err = e; }
  expect(err, `expected DB error containing "${match}"`).toBeDefined();
  const pgErr = err.cause ?? err;
  const text = `${pgErr.constraint ?? ''} ${pgErr.message ?? ''}`;
  expect(text).toContain(match);
}
