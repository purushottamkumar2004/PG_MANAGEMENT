// Structure read APIs (T-04): Building -> Floors -> Rooms -> Beds -> Bed detail.
// Roles owner and manager only. Every id is resolved to its building and checked with
// assertBuildingAccess; anything outside the user's scope is 404 NOT_FOUND.
// Counts are done in SQL; only active tenants occupy a bed (locked rule 9).
import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { assertBuildingAccess } from '../lib/scope.js';
import { bedStatus } from '../lib/bedStatus.js';
import { todayIST } from '../lib/dates.js';
import { naturalCompare } from '../lib/natural-sort.js';
import { notFound } from '../lib/errors.js';
import { isUuid } from '../lib/uuid.js';

export const structureRouter = Router();

// Applied per route (not router.use) so this router, mounted at /api, never touches other paths.
const guard = [requireAuth, requireRole('owner', 'manager')];

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const q = async (text, params) => (await pool.query(text, params)).rows;

/** India-time today and rent month, read once per request. */
function nowIST() {
  const today = todayIST(new Date());
  return { today, month: today.slice(0, 7) };
}

// Active tenant on a bed, plus that tenant's current-month payment row.
const TENANT_JOIN = `
  LEFT JOIN tenant t ON t.bed_id = bd.id AND t.record_status = 'active'
  LEFT JOIN payment p ON p.tenant_id = t.id AND p.month = $2`;

// GET /api/buildings
structureRouter.get('/buildings', guard, wrap(async (req, res) => {
  const { role, owner_id, building_id } = req.user;
  const scope = role === 'manager' ? 'b.owner_id = $1 AND b.id = $2' : 'b.owner_id = $1';
  const params = role === 'manager' ? [owner_id, building_id] : [owner_id];
  const rows = await q(`
    SELECT b.id, b.name, b.address, b.photo_url,
           count(bd.id)::int AS total_beds,
           count(t.id)::int  AS occupied_beds
    FROM building b
    LEFT JOIN floor f  ON f.building_id = b.id
    LEFT JOIN room r   ON r.floor_id = f.id
    LEFT JOIN bed bd   ON bd.room_id = r.id
    LEFT JOIN tenant t ON t.bed_id = bd.id AND t.record_status = 'active'
    WHERE ${scope}
    GROUP BY b.id
    ORDER BY b.name, b.id`, params);
  res.json({ buildings: rows.map((r) => ({ ...r, free_beds: r.total_beds - r.occupied_beds })) });
}));

// GET /api/buildings/:buildingId/floors
structureRouter.get('/buildings/:buildingId/floors', guard, wrap(async (req, res) => {
  const { buildingId } = req.params;
  await assertBuildingAccess(req.user, buildingId);
  const rows = await q(`
    SELECT b.id AS building_id, b.name AS building_name,
           f.id, f.floor_number,
           count(bd.id)::int AS total_beds,
           count(t.id)::int  AS occupied_beds
    FROM building b
    LEFT JOIN floor f  ON f.building_id = b.id
    LEFT JOIN room r   ON r.floor_id = f.id
    LEFT JOIN bed bd   ON bd.room_id = r.id
    LEFT JOIN tenant t ON t.bed_id = bd.id AND t.record_status = 'active'
    WHERE b.id = $1
    GROUP BY b.id, f.id
    ORDER BY f.floor_number`, [buildingId]);
  if (!rows.length) throw notFound('Building not found');
  res.json({
    building: { id: rows[0].building_id, name: rows[0].building_name },
    floors: rows.filter((r) => r.id !== null).map((r) => ({
      id: r.id, floor_number: r.floor_number, total_beds: r.total_beds, free_beds: r.total_beds - r.occupied_beds,
    })),
  });
}));

// GET /api/floors/:floorId/rooms
structureRouter.get('/floors/:floorId/rooms', guard, wrap(async (req, res) => {
  const { floorId } = req.params;
  if (!isUuid(floorId)) throw notFound('Floor not found');
  const rows = await q(`
    SELECT f.id AS floor_id, f.floor_number, f.building_id,
           r.id, r.room_number, r.bed_capacity,
           count(bd.id)::int AS total_beds,
           count(t.id)::int  AS occupied_beds
    FROM floor f
    LEFT JOIN room r   ON r.floor_id = f.id
    LEFT JOIN bed bd   ON bd.room_id = r.id
    LEFT JOIN tenant t ON t.bed_id = bd.id AND t.record_status = 'active'
    WHERE f.id = $1
    GROUP BY f.id, r.id`, [floorId]);
  if (!rows.length) throw notFound('Floor not found');
  const f = rows[0];
  await assertBuildingAccess(req.user, f.building_id);
  const rooms = rows.filter((r) => r.id !== null).map((r) => ({
    id: r.id, room_number: r.room_number, bed_capacity: r.bed_capacity, free_beds: r.total_beds - r.occupied_beds,
  }));
  rooms.sort((a, b) => naturalCompare(a.room_number, b.room_number));
  res.json({ floor: { id: f.floor_id, floor_number: f.floor_number, building_id: f.building_id }, rooms });
}));

// GET /api/rooms/:roomId/beds
structureRouter.get('/rooms/:roomId/beds', guard, wrap(async (req, res) => {
  const { roomId } = req.params;
  if (!isUuid(roomId)) throw notFound('Room not found');
  const { today, month } = nowIST();
  const rows = await q(`
    SELECT r.id AS room_id, r.room_number, r.bed_capacity, r.floor_id, f.floor_number, f.building_id,
           bd.id, bd.bed_label,
           t.id AS tenant_id, t.name AS tenant_name,
           p.payment_status
    FROM room r
    JOIN floor f ON f.id = r.floor_id
    LEFT JOIN bed bd ON bd.room_id = r.id
    ${TENANT_JOIN}
    WHERE r.id = $1
    ORDER BY bd.bed_label`, [roomId, month]);
  if (!rows.length) throw notFound('Room not found');
  const r = rows[0];
  await assertBuildingAccess(req.user, r.building_id);
  res.json({
    room: {
      id: r.room_id, room_number: r.room_number, bed_capacity: r.bed_capacity,
      floor_id: r.floor_id, floor_number: r.floor_number, building_id: r.building_id,
    },
    beds: rows.filter((b) => b.id !== null).map((b) => ({
      id: b.id,
      bed_label: b.bed_label,
      status: bedStatus({ hasTenant: b.tenant_id !== null, paymentStatus: b.payment_status, today }),
      tenant: b.tenant_id === null ? null : { id: b.tenant_id, name: b.tenant_name },
    })),
  });
}));

// GET /api/beds/:bedId
structureRouter.get('/beds/:bedId', guard, wrap(async (req, res) => {
  const { bedId } = req.params;
  if (!isUuid(bedId)) throw notFound('Bed not found');
  const { today, month } = nowIST();
  const [row] = await q(`
    SELECT bd.id, bd.bed_label, bd.room_id, r.room_number, f.floor_number,
           b.id AS building_id, b.name AS building_name,
           t.id AS tenant_id, t.name, t.phone, t.age, t.aadhaar_last4, t.monthly_rent, t.deposit,
           to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
           p.id AS payment_id, p.month, p.amount_due, p.amount_paid, p.payment_status,
           to_char(p.payment_date, 'YYYY-MM-DD') AS payment_date
    FROM bed bd
    JOIN room r     ON r.id = bd.room_id
    JOIN floor f    ON f.id = r.floor_id
    JOIN building b ON b.id = f.building_id
    ${TENANT_JOIN}
    WHERE bd.id = $1`, [bedId, month]);
  if (!row) throw notFound('Bed not found');
  await assertBuildingAccess(req.user, row.building_id);

  const hasTenant = row.tenant_id !== null;
  res.json({
    bed: {
      id: row.id, bed_label: row.bed_label,
      status: bedStatus({ hasTenant, paymentStatus: row.payment_status, today }),
      room_id: row.room_id, room_number: row.room_number, floor_number: row.floor_number,
      building_id: row.building_id, building_name: row.building_name,
    },
    tenant: !hasTenant ? null : {
      id: row.tenant_id, name: row.name, phone: row.phone, age: row.age, aadhaar_last4: row.aadhaar_last4,
      monthly_rent: row.monthly_rent, deposit: row.deposit, start_date: row.start_date,
      current_month: row.payment_id === null ? null : {
        month: row.month, amount_due: row.amount_due, amount_paid: row.amount_paid,
        payment_status: row.payment_status, payment_date: row.payment_date,
      },
    },
  });
}));
