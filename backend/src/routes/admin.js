// Admin setup API (T-03b). Contract: docs/API_CONTRACT.md "Admin setup".
// Admin onboards owners and sets up structure only. It never touches tenants,
// payments or the transaction log (locked rule 2).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { admin, owner, building, manager, floor, room, bed } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validationError, notFound, conflict } from '../lib/errors.js';
import { isUuid } from '../lib/uuid.js';
import { naturalCompare } from '../lib/natural-sort.js';

const BCRYPT_COST = 10;
const BED_LABELS = ['A', 'B', 'C'];

// ---------- validation ----------

const name = z.string().trim().min(1, 'name must be 1-100 characters').max(100, 'name must be 1-100 characters');
const phone = z.string().regex(/^[6-9][0-9]{9}$/, 'phone must be 10 digits starting 6-9');
const password = z.string().min(6, 'password must be 6-100 characters').max(100, 'password must be 6-100 characters');
const address = z.string().trim().max(200, 'address must be up to 200 characters').nullable()
  .transform((v) => (v === '' ? null : v));
const photoUrl = z.string().trim().max(500, 'photo_url must be up to 500 characters')
  .refine((v) => {
    try { return new URL(v).protocol === 'https:'; } catch { return false; }
  }, 'photo_url must be an https URL')
  .nullable();

const atLeastOne = (s) => s.refine((o) => Object.values(o).some((v) => v !== undefined), 'Nothing to update');

const schemas = {
  createOwner: z.object({ name, phone, password }),
  patchOwner: atLeastOne(z.object({ is_active: z.boolean().optional(), name: name.optional(), password: password.optional() })),
  createBuilding: z.object({ name, address: address.optional(), photo_url: photoUrl.optional() }),
  patchBuilding: atLeastOne(z.object({ name: name.optional(), address: address.optional(), photo_url: photoUrl.optional() })),
  createFloor: z.object({ floor_number: z.number().int('floor_number must be 0-200').min(0, 'floor_number must be 0-200').max(200, 'floor_number must be 0-200') }),
  createRoom: z.object({
    room_number: z.string().trim().min(1, 'room_number must be 1-10 characters').max(10, 'room_number must be 1-10 characters'),
    bed_capacity: z.union([z.literal(2), z.literal(3)], { error: 'bed_capacity must be 2 or 3' }),
  }),
  createManager: z.object({ name, phone, password }),
  patchManager: atLeastOne(z.object({
    name: name.optional(), phone: phone.optional(), password: password.optional(), is_active: z.boolean().optional(),
  })),
};

function parse(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw validationError(r.error.issues[0]?.message ?? 'Invalid input');
  return r.data;
}

/** Malformed ids are treated like unknown ids: 404. */
function idParam(req, key, what) {
  const v = req.params[key];
  if (!isUuid(v)) throw notFound(`${what} not found`);
  return v;
}

// ---------- response shapes (whitelisted, never hashes) ----------

const ownerOut = (o) => ({ id: o.id, name: o.name, phone: o.phone, is_active: o.is_active });
const buildingOut = (b) => ({ id: b.id, owner_id: b.owner_id, name: b.name, address: b.address, photo_url: b.photo_url });
const managerOut = (m) => ({
  id: m.id, building_id: m.building_id, name: m.name, phone: m.phone, is_active: m.is_active,
  has_season_code: m.current_code_hash != null,
});

// ---------- helpers ----------

const hash = (s) => bcrypt.hash(s, BCRYPT_COST);

/**
 * Phones are unique across admin, owner and manager (contract). Runs inside the caller's
 * transaction with an advisory lock on the phone, so two parallel requests for the same phone
 * cannot both pass the check. `self` = { table, id } skips the row being updated.
 */
async function assertPhoneFree(tx, phoneValue, self) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`phone:${phoneValue}`}))`);
  for (const t of [admin, owner, manager]) {
    const where = self?.table === t ? and(eq(t.phone, phoneValue), ne(t.id, self.id)) : eq(t.phone, phoneValue);
    const [hit] = await tx.select({ id: t.id }).from(t).where(where).limit(1);
    if (hit) throw conflict('PHONE_TAKEN', 'This phone number is already in use');
  }
}

// Fallback when the DB unique constraint fires anyway (race with a non-locking writer).
const UNIQUE_MAP = {
  admin_phone_unique: () => conflict('PHONE_TAKEN', 'This phone number is already in use'),
  owner_phone_unique: () => conflict('PHONE_TAKEN', 'This phone number is already in use'),
  manager_phone_unique: () => conflict('PHONE_TAKEN', 'This phone number is already in use'),
  manager_building_id_unique: () => conflict('MANAGER_EXISTS', 'This building already has a manager'),
  floor_building_number_uq: () => conflict('CONFLICT', 'This floor number already exists'),
  room_floor_number_uq: () => conflict('CONFLICT', 'This room number already exists on this floor'),
};

export function mapDbError(err) {
  const pgErr = err?.cause ?? err;
  if (pgErr?.code === '23505' && UNIQUE_MAP[pgErr.constraint]) return UNIQUE_MAP[pgErr.constraint]();
  return err;
}

/** Runs fn in a transaction and turns known unique violations into contract errors. */
async function inTx(fn) {
  try {
    return await db.transaction(fn);
  } catch (err) {
    throw mapDbError(err);
  }
}

async function findOne(executor, table, id) {
  const [row] = await executor.select().from(table).where(eq(table.id, id)).limit(1);
  return row ?? null;
}

// ---------- routes ----------

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

// Owners

adminRouter.get('/owners', async (_req, res) => {
  const rows = await db.select({
    id: owner.id, name: owner.name, phone: owner.phone, is_active: owner.is_active,
    building_count: sql`count(${building.id})::int`,
  }).from(owner)
    .leftJoin(building, eq(building.owner_id, owner.id))
    .groupBy(owner.id)
    .orderBy(asc(owner.name), asc(owner.created_at));
  res.json({ owners: rows });
});

adminRouter.post('/owners', async (req, res) => {
  const body = parse(schemas.createOwner, req.body);
  const password_hash = await hash(body.password);
  const created = await inTx(async (tx) => {
    await assertPhoneFree(tx, body.phone);
    const [o] = await tx.insert(owner).values({ name: body.name, phone: body.phone, password_hash }).returning();
    return o;
  });
  res.status(201).json({ owner: ownerOut(created) });
});

adminRouter.patch('/owners/:ownerId', async (req, res) => {
  const ownerId = idParam(req, 'ownerId', 'Owner');
  const body = parse(schemas.patchOwner, req.body);
  const set = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.is_active !== undefined) set.is_active = body.is_active;
  if (body.password !== undefined) set.password_hash = await hash(body.password);

  const [o] = await db.update(owner).set(set).where(eq(owner.id, ownerId)).returning();
  if (!o) throw notFound('Owner not found');
  res.json({ owner: ownerOut(o) });
});

// Buildings and structure

adminRouter.get('/owners/:ownerId/buildings', async (req, res) => {
  const ownerId = idParam(req, 'ownerId', 'Owner');
  if (!(await findOne(db, owner, ownerId))) throw notFound('Owner not found');

  const buildings = await db.select().from(building)
    .where(eq(building.owner_id, ownerId)).orderBy(asc(building.name), asc(building.created_at));
  const bIds = buildings.map((b) => b.id);

  const managers = bIds.length ? await db.select().from(manager).where(inArray(manager.building_id, bIds)) : [];
  const floors = bIds.length
    ? await db.select().from(floor).where(inArray(floor.building_id, bIds)).orderBy(asc(floor.floor_number))
    : [];
  const fIds = floors.map((f) => f.id);
  const rooms = fIds.length ? await db.select().from(room).where(inArray(room.floor_id, fIds)) : [];
  rooms.sort((a, b) => naturalCompare(a.room_number, b.room_number));

  const managerBy = new Map(managers.map((m) => [m.building_id, m]));
  const roomsBy = new Map();
  for (const r of rooms) {
    if (!roomsBy.has(r.floor_id)) roomsBy.set(r.floor_id, []);
    roomsBy.get(r.floor_id).push({ id: r.id, room_number: r.room_number, bed_capacity: r.bed_capacity });
  }
  const floorsBy = new Map();
  for (const f of floors) {
    if (!floorsBy.has(f.building_id)) floorsBy.set(f.building_id, []);
    floorsBy.get(f.building_id).push({ id: f.id, floor_number: f.floor_number, rooms: roomsBy.get(f.id) ?? [] });
  }

  res.json({
    buildings: buildings.map((b) => {
      const m = managerBy.get(b.id);
      return {
        id: b.id, name: b.name, address: b.address, photo_url: b.photo_url,
        manager: m ? { id: m.id, name: m.name, phone: m.phone, is_active: m.is_active } : null,
        floors: floorsBy.get(b.id) ?? [],
      };
    }),
  });
});

adminRouter.post('/owners/:ownerId/buildings', async (req, res) => {
  const ownerId = idParam(req, 'ownerId', 'Owner');
  const body = parse(schemas.createBuilding, req.body);
  const created = await inTx(async (tx) => {
    if (!(await findOne(tx, owner, ownerId))) throw notFound('Owner not found');
    const [b] = await tx.insert(building).values({
      owner_id: ownerId, name: body.name, address: body.address ?? null, photo_url: body.photo_url ?? null,
    }).returning();
    return b;
  });
  res.status(201).json({ building: buildingOut(created) });
});

adminRouter.patch('/buildings/:buildingId', async (req, res) => {
  const buildingId = idParam(req, 'buildingId', 'Building');
  const body = parse(schemas.patchBuilding, req.body);
  const [b] = await db.update(building).set(body).where(eq(building.id, buildingId)).returning();
  if (!b) throw notFound('Building not found');
  res.json({ building: buildingOut(b) });
});

adminRouter.post('/buildings/:buildingId/floors', async (req, res) => {
  const buildingId = idParam(req, 'buildingId', 'Building');
  const body = parse(schemas.createFloor, req.body);
  const created = await inTx(async (tx) => {
    if (!(await findOne(tx, building, buildingId))) throw notFound('Building not found');
    const [dup] = await tx.select({ id: floor.id }).from(floor)
      .where(and(eq(floor.building_id, buildingId), eq(floor.floor_number, body.floor_number))).limit(1);
    if (dup) throw conflict('CONFLICT', 'This floor number already exists');
    const [f] = await tx.insert(floor).values({ building_id: buildingId, floor_number: body.floor_number }).returning();
    return f;
  });
  res.status(201).json({ floor: { id: created.id, building_id: created.building_id, floor_number: created.floor_number } });
});

adminRouter.post('/floors/:floorId/rooms', async (req, res) => {
  const floorId = idParam(req, 'floorId', 'Floor');
  const body = parse(schemas.createRoom, req.body);
  const { r, beds } = await inTx(async (tx) => {
    if (!(await findOne(tx, floor, floorId))) throw notFound('Floor not found');
    const [dup] = await tx.select({ id: room.id }).from(room)
      .where(and(eq(room.floor_id, floorId), eq(room.room_number, body.room_number))).limit(1);
    if (dup) throw conflict('CONFLICT', 'This room number already exists on this floor');
    const [rm] = await tx.insert(room).values({
      floor_id: floorId, room_number: body.room_number, bed_capacity: body.bed_capacity,
    }).returning();
    const bedRows = await tx.insert(bed)
      .values(BED_LABELS.slice(0, body.bed_capacity).map((bed_label) => ({ room_id: rm.id, bed_label })))
      .returning();
    return { r: rm, beds: bedRows };
  });
  beds.sort((a, b) => a.bed_label.localeCompare(b.bed_label));
  res.status(201).json({
    room: { id: r.id, floor_id: r.floor_id, room_number: r.room_number, bed_capacity: r.bed_capacity },
    beds: beds.map((b) => ({ id: b.id, bed_label: b.bed_label })),
  });
});

// Managers

adminRouter.post('/buildings/:buildingId/manager', async (req, res) => {
  const buildingId = idParam(req, 'buildingId', 'Building');
  const body = parse(schemas.createManager, req.body);
  const password_hash = await hash(body.password);
  const created = await inTx(async (tx) => {
    // Lock the building row so two parallel creates cannot both pass the check.
    const [b] = await tx.select().from(building).where(eq(building.id, buildingId)).for('update').limit(1);
    if (!b) throw notFound('Building not found');
    const [existing] = await tx.select({ id: manager.id }).from(manager).where(eq(manager.building_id, buildingId)).limit(1);
    if (existing) throw conflict('MANAGER_EXISTS', 'This building already has a manager');
    await assertPhoneFree(tx, body.phone);
    const [m] = await tx.insert(manager).values({
      owner_id: b.owner_id, building_id: buildingId, name: body.name, phone: body.phone, password_hash,
    }).returning();
    return m;
  });
  res.status(201).json({ manager: managerOut(created) });
});

adminRouter.patch('/managers/:managerId', async (req, res) => {
  const managerId = idParam(req, 'managerId', 'Manager');
  const body = parse(schemas.patchManager, req.body);
  const set = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.phone !== undefined) set.phone = body.phone;
  if (body.is_active !== undefined) set.is_active = body.is_active;
  if (body.password !== undefined) set.password_hash = await hash(body.password);

  const updated = await inTx(async (tx) => {
    if (!(await findOne(tx, manager, managerId))) throw notFound('Manager not found');
    if (set.phone !== undefined) await assertPhoneFree(tx, set.phone, { table: manager, id: managerId });
    const [m] = await tx.update(manager).set(set).where(eq(manager.id, managerId)).returning();
    return m;
  });
  res.json({ manager: managerOut(updated) });
});
