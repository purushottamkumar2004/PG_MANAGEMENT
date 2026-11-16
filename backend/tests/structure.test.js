import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool, db } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { owner, manager } from '../src/db/schema.js';
import { createBuildingStructure } from '../src/db/structure.js';
import { signToken } from '../src/lib/jwt.js';
import { truncateAll, nextPhone } from './helpers.js';

// Seed runs on 5 Nov 2026 (India), so "this month" in the seed is 2026-11.
const DAY5 = '2026-11-05T12:00:00+05:30';
const DAY6 = '2026-11-06T09:00:00+05:30';
const setNow = (iso) => vi.setSystemTime(new Date(iso));

const rows = async (text, params) => (await pool.query(text, params)).rows;
const one = async (text, params) => (await rows(text, params))[0];

let U; // { id, role } by user; tokens are signed per request so the faked clock never expires them
let B; // building ids by name
const userFor = async (phone) => {
  for (const role of ['admin', 'owner', 'manager']) {
    const r = await one(`SELECT id FROM ${role} WHERE phone = $1`, [phone]);
    if (r) return { id: r.id, role };
  }
  throw new Error(`no user ${phone}`);
};

const get = (path, who = 'owner1') => request(app).get(`/api${path}`).set('Authorization', `Bearer ${signToken(U[who])}`);
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: { code, message: expect.any(String) } });
};
const expectNoSecrets = (res) => expect(JSON.stringify(res.body)).not.toMatch(/password_hash|current_code_hash|\$2[aby]\$/);

const floorId = (building, n) => one(
  'SELECT f.id FROM floor f JOIN building b ON b.id = f.building_id WHERE b.name = $1 AND f.floor_number = $2',
  [building, n]).then((r) => r.id);
const roomId = (building, roomNumber) => one(
  `SELECT r.id FROM room r JOIN floor f ON f.id = r.floor_id JOIN building b ON b.id = f.building_id
   WHERE b.name = $1 AND r.room_number = $2`, [building, roomNumber]).then((r) => r.id);
const bedId = (building, roomNumber, label) => one(
  `SELECT bd.id FROM bed bd JOIN room r ON r.id = bd.room_id JOIN floor f ON f.id = r.floor_id
   JOIN building b ON b.id = f.building_id WHERE b.name = $1 AND r.room_number = $2 AND bd.bed_label = $3`,
  [building, roomNumber, label]).then((r) => r.id);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  setNow(DAY5);
  await truncateAll();
  await seed();
  U = {
    admin: await userFor('9000000000'),
    owner1: await userFor('9000000001'),
    manager1: await userFor('9000000002'), // Shanti PG
    manager2: await userFor('9000000003'), // Sai Residency
    owner2: await userFor('9000000004'),
    manager3: await userFor('9000000005'), // Green Nest PG
  };
  B = Object.fromEntries((await rows('SELECT id, name FROM building')).map((r) => [r.name, r.id]));
});
afterEach(() => setNow(DAY5));
afterAll(async () => { vi.useRealTimers(); await pool.end(); });

describe('GET /api/buildings', () => {
  it('owner 1 sees both buildings sorted by name with seed counts', async () => {
    const res = await get('/buildings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      buildings: [
        { id: B['Sai Residency'], name: 'Sai Residency', address: 'Hinjewadi, Pune', photo_url: null, total_beds: 6, occupied_beds: 2, free_beds: 4 },
        { id: B['Shanti PG'], name: 'Shanti PG', address: 'Kothrud, Pune', photo_url: null, total_beds: 10, occupied_beds: 4, free_beds: 6 },
      ],
    });
    expectNoSecrets(res);
  });

  it('owner 2 sees only Green Nest PG', async () => {
    const res = await get('/buildings', 'owner2');
    expect(res.status).toBe(200);
    expect(res.body.buildings).toEqual([
      { id: B['Green Nest PG'], name: 'Green Nest PG', address: 'Baner, Pune', photo_url: null, total_beds: 2, occupied_beds: 1, free_beds: 1 },
    ]);
  });

  it('manager gets a one-item list with their own building', async () => {
    const res = await get('/buildings', 'manager1');
    expect(res.status).toBe(200);
    expect(res.body.buildings.map((b) => b.name)).toEqual(['Shanti PG']);
    expect(res.body.buildings[0]).toMatchObject({ total_beds: 10, occupied_beds: 4, free_beds: 6 });
    const res2 = await get('/buildings', 'manager2');
    expect(res2.body.buildings.map((b) => b.name)).toEqual(['Sai Residency']);
  });

  it('a building with no floors yet shows zero beds', async () => {
    const o1 = await one(`SELECT id FROM owner WHERE phone = '9000000001'`);
    const { rows: [b] } = await pool.query(`INSERT INTO building (owner_id, name) VALUES ($1, 'Aaa Empty') RETURNING id`, [o1.id]);
    try {
      const res = await get('/buildings');
      expect(res.body.buildings[0]).toEqual({ id: b.id, name: 'Aaa Empty', address: null, photo_url: null, total_beds: 0, occupied_beds: 0, free_beds: 0 });
      const floors = await get(`/buildings/${b.id}/floors`);
      expect(floors.status).toBe(200);
      expect(floors.body).toEqual({ building: { id: b.id, name: 'Aaa Empty' }, floors: [] });
    } finally {
      await pool.query('DELETE FROM building WHERE id = $1', [b.id]);
    }
  });
});

describe('GET /api/buildings/:buildingId/floors', () => {
  it('returns floors sorted by number with total and free beds', async () => {
    const res = await get(`/buildings/${B['Shanti PG']}/floors`, 'manager1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      building: { id: B['Shanti PG'], name: 'Shanti PG' },
      floors: [
        { id: await floorId('Shanti PG', 1), floor_number: 1, total_beds: 5, free_beds: 2 },
        { id: await floorId('Shanti PG', 2), floor_number: 2, total_beds: 5, free_beds: 4 },
      ],
    });
  });

  it('owner sees floors of each own building', async () => {
    const res = await get(`/buildings/${B['Sai Residency']}/floors`);
    expect(res.body.floors).toEqual([{ id: await floorId('Sai Residency', 1), floor_number: 1, total_beds: 6, free_beds: 4 }]);
  });
});

describe('GET /api/floors/:floorId/rooms', () => {
  it('returns rooms with free beds', async () => {
    const f1 = await floorId('Shanti PG', 1);
    const res = await get(`/floors/${f1}/rooms`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      floor: { id: f1, floor_number: 1, building_id: B['Shanti PG'] },
      rooms: [
        { id: await roomId('Shanti PG', '101'), room_number: '101', bed_capacity: 3, free_beds: 1 },
        { id: await roomId('Shanti PG', '102'), room_number: '102', bed_capacity: 2, free_beds: 1 },
      ],
    });
    const f2 = await get(`/floors/${await floorId('Shanti PG', 2)}/rooms`, 'manager1');
    expect(f2.body.rooms.map((r) => [r.room_number, r.free_beds])).toEqual([['201', 2], ['202', 2]]);
  });

  it('sorts room numbers naturally ("2" before "10")', async () => {
    const [o] = await db.insert(owner).values({ name: 'Sort Owner', phone: nextPhone(), password_hash: 'x' }).returning();
    const s = await createBuildingStructure(db, {
      owner_id: o.id, name: 'Sort PG',
      floors: [{ number: 0, rooms: ['10', '2', 'G10', '1', 'G2', '9'].map((number) => ({ number, capacity: 2 })) }],
    });
    const f = await one('SELECT id FROM floor WHERE building_id = $1', [s.building.id]);
    const token = signToken({ id: o.id, role: 'owner' });
    const res = await request(app).get(`/api/floors/${f.id}/rooms`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rooms.map((r) => r.room_number)).toEqual(['1', '2', '9', '10', 'G2', 'G10']);
    expect(res.body.rooms.every((r) => r.free_beds === 2)).toBe(true);
    // the new owner cannot see owner 1's data
    const other = await request(app).get(`/api/floors/${await floorId('Shanti PG', 1)}/rooms`).set('Authorization', `Bearer ${token}`);
    expectError(other, 404, 'NOT_FOUND');
  });
});

describe('GET /api/rooms/:roomId/beds (status on day 5)', () => {
  it('room 101: paid, partial, vacant; sorted by label; tenant name only', async () => {
    const r101 = await roomId('Shanti PG', '101');
    const f1 = await floorId('Shanti PG', 1);
    const res = await get(`/rooms/${r101}/beds`, 'manager1');
    expect(res.status).toBe(200);
    const amit = await one(`SELECT id FROM tenant WHERE name = 'Amit Kumar'`);
    const rahul = await one(`SELECT id FROM tenant WHERE name = 'Rahul Verma'`);
    expect(res.body).toEqual({
      room: { id: r101, room_number: '101', bed_capacity: 3, floor_id: f1, floor_number: 1, building_id: B['Shanti PG'] },
      beds: [
        { id: await bedId('Shanti PG', '101', 'A'), bed_label: 'A', status: 'paid', tenant: { id: amit.id, name: 'Amit Kumar' } },
        { id: await bedId('Shanti PG', '101', 'B'), bed_label: 'B', status: 'partial', tenant: { id: rahul.id, name: 'Rahul Verma' } },
        { id: await bedId('Shanti PG', '101', 'C'), bed_label: 'C', status: 'vacant', tenant: null },
      ],
    });
  });

  it('room 102: pending (day 5) and vacant', async () => {
    const res = await get(`/rooms/${await roomId('Shanti PG', '102')}/beds`);
    expect(res.body.beds.map((b) => [b.bed_label, b.status, b.tenant?.name ?? null])).toEqual([
      ['A', 'pending', 'Vikas Singh'], ['B', 'vacant', null],
    ]);
  });
});

describe('bed status by date (India time)', () => {
  const statuses = async () => {
    const res = await get(`/rooms/${await roomId('Shanti PG', '101')}/beds`);
    const res2 = await get(`/rooms/${await roomId('Shanti PG', '102')}/beds`);
    return [...res.body.beds, ...res2.body.beds].map((b) => b.status);
  };

  it('day 6: partial and pending become overdue, paid stays paid', async () => {
    setNow(DAY6);
    expect(await statuses()).toEqual(['paid', 'overdue', 'vacant', 'overdue', 'vacant']);
  });

  it('uses India date, not UTC: 23:30 IST on the 5th is not overdue, 00:30 IST on the 6th is', async () => {
    setNow('2026-11-05T18:00:00Z'); // 23:30 IST, 5 Nov
    expect(await statuses()).toEqual(['paid', 'partial', 'vacant', 'pending', 'vacant']);
    setNow('2026-11-05T19:00:00Z'); // 00:30 IST, 6 Nov (still 5 Nov in UTC)
    expect(await statuses()).toEqual(['paid', 'overdue', 'vacant', 'overdue', 'vacant']);
  });

  it('first days of a new month with no rows yet: pending, then overdue after the 5th', async () => {
    setNow('2026-12-02T10:00:00+05:30');
    expect(await statuses()).toEqual(['pending', 'pending', 'vacant', 'pending', 'vacant']);
    const detail = await get(`/beds/${await bedId('Shanti PG', '101', 'A')}`);
    expect(detail.body.bed.status).toBe('pending');
    expect(detail.body.tenant.current_month).toBeNull(); // last month's paid row is not "current"
    setNow('2026-12-06T10:00:00+05:30');
    expect(await statuses()).toEqual(['overdue', 'overdue', 'vacant', 'overdue', 'vacant']);
  });

  it('a tenant with no current-month row: pending on day 5, overdue on day 6', async () => {
    const bed = await bedId('Shanti PG', '101', 'C');
    const m1 = await one(`SELECT id, building_id FROM manager WHERE phone = '9000000002'`);
    const { rows: [t] } = await pool.query(
      `INSERT INTO tenant (building_id, bed_id, created_by_manager_id, name, phone, monthly_rent, deposit, start_date)
       VALUES ($1, $2, $3, 'No Row Yet', '9876500099', 7000, 0, '2026-11-01') RETURNING id`,
      [m1.building_id, bed, m1.id]);
    try {
      let res = await get(`/beds/${bed}`, 'manager1');
      expect(res.body.bed.status).toBe('pending');
      expect(res.body.tenant).toMatchObject({ id: t.id, name: 'No Row Yet', current_month: null, age: null, aadhaar_last4: null });
      setNow(DAY6);
      res = await get(`/beds/${bed}`, 'manager1');
      expect(res.body.bed.status).toBe('overdue');
      const list = await get(`/rooms/${await roomId('Shanti PG', '101')}/beds`);
      expect(list.body.beds[2]).toEqual({ id: bed, bed_label: 'C', status: 'overdue', tenant: { id: t.id, name: 'No Row Yet' } });
    } finally {
      await pool.query('DELETE FROM tenant WHERE id = $1', [t.id]);
    }
  });
});

describe('GET /api/beds/:bedId', () => {
  it('occupied bed returns full tenant data with current_month', async () => {
    const bed = await bedId('Shanti PG', '101', 'B');
    const rahul = await one(`SELECT id FROM tenant WHERE name = 'Rahul Verma'`);
    const res = await get(`/beds/${bed}`, 'manager1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bed: {
        id: bed, bed_label: 'B', status: 'partial', room_id: await roomId('Shanti PG', '101'), room_number: '101',
        floor_number: 1, building_id: B['Shanti PG'], building_name: 'Shanti PG',
      },
      tenant: {
        id: rahul.id, name: 'Rahul Verma', phone: '9876500002', age: 24, aadhaar_last4: '5678',
        monthly_rent: 7000, deposit: 7000, start_date: '2026-10-01',
        current_month: { month: '2026-11', amount_due: 7000, amount_paid: 3000, payment_status: 'partial', payment_date: '2026-11-05' },
      },
    });
    expectNoSecrets(res);
  });

  it('owner sees the same tenant data read-only (D-02)', async () => {
    const bed = await bedId('Shanti PG', '102', 'A');
    const res = await get(`/beds/${bed}`, 'owner1');
    expect(res.status).toBe(200);
    expect(res.body.bed.status).toBe('pending');
    expect(res.body.tenant).toMatchObject({
      name: 'Vikas Singh', aadhaar_last4: null,
      current_month: { month: '2026-11', amount_due: 7500, amount_paid: 0, payment_status: 'pending', payment_date: null },
    });
  });

  it('vacant bed returns tenant null', async () => {
    const bed = await bedId('Shanti PG', '202', 'B');
    const res = await get(`/beds/${bed}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bed: {
        id: bed, bed_label: 'B', status: 'vacant', room_id: await roomId('Shanti PG', '202'), room_number: '202',
        floor_number: 2, building_id: B['Shanti PG'], building_name: 'Shanti PG',
      },
      tenant: null,
    });
  });
});

describe('archived tenants never appear (locked rule 9)', () => {
  it('seed past tenant is nowhere in the drill-down', async () => {
    const paths = ['/buildings', `/buildings/${B['Shanti PG']}/floors`];
    for (const f of await rows('SELECT id FROM floor WHERE building_id = $1', [B['Shanti PG']])) paths.push(`/floors/${f.id}/rooms`);
    const rooms = await rows('SELECT r.id FROM room r JOIN floor f ON f.id = r.floor_id WHERE f.building_id = $1', [B['Shanti PG']]);
    for (const r of rooms) paths.push(`/rooms/${r.id}/beds`);
    const beds = await rows(`SELECT bd.id FROM bed bd JOIN room r ON r.id = bd.room_id JOIN floor f ON f.id = r.floor_id WHERE f.building_id = $1`, [B['Shanti PG']]);
    for (const b of beds) paths.push(`/beds/${b.id}`);
    for (const p of paths) {
      const res = await get(p, 'manager1');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('Old Tenant Deepak');
    }
  });

  it('a tenant checked out of a bed leaves it vacant and uncounted', async () => {
    const bed = await bedId('Shanti PG', '202', 'A');
    const m1 = await one(`SELECT id, building_id FROM manager WHERE phone = '9000000002'`);
    const { rows: [t] } = await pool.query(
      `INSERT INTO tenant (building_id, bed_id, created_by_manager_id, name, phone, monthly_rent, deposit, start_date)
       VALUES ($1, $2, $3, 'Left Recently', '9876500098', 7000, 0, '2026-11-01') RETURNING id`,
      [m1.building_id, bed, m1.id]);
    try {
      expect((await get(`/beds/${bed}`)).body.tenant.name).toBe('Left Recently');
      expect((await get('/buildings', 'manager1')).body.buildings[0].occupied_beds).toBe(5);
      await pool.query(`UPDATE tenant SET record_status = 'archived', bed_id = NULL, checkout_date = '2026-11-05' WHERE id = $1`, [t.id]);
      const res = await get(`/beds/${bed}`);
      expect(res.body.bed.status).toBe('vacant');
      expect(res.body.tenant).toBeNull();
      expect((await get('/buildings', 'manager1')).body.buildings[0]).toMatchObject({ occupied_beds: 4, free_beds: 6 });
      const room = await get(`/rooms/${await roomId('Shanti PG', '202')}/beds`);
      expect(JSON.stringify(room.body)).not.toContain('Left Recently');
    } finally {
      await pool.query('DELETE FROM tenant WHERE id = $1', [t.id]);
    }
  });
});

describe('scope: cross-building and cross-owner access -> 404', () => {
  const allPaths = async (building, roomNumber) => {
    const f = await one('SELECT id FROM floor WHERE building_id = $1 ORDER BY floor_number LIMIT 1', [B[building]]);
    return [
      `/buildings/${B[building]}/floors`,
      `/floors/${f.id}/rooms`,
      `/rooms/${await roomId(building, roomNumber)}/beds`,
      `/beds/${await bedId(building, roomNumber, 'A')}`,
    ];
  };

  it('manager of Shanti PG gets 404 for Sai Residency (same owner)', async () => {
    for (const p of await allPaths('Sai Residency', '101')) expectError(await get(p, 'manager1'), 404, 'NOT_FOUND');
  });

  it('manager of Shanti PG gets 404 for Green Nest PG (other owner)', async () => {
    for (const p of await allPaths('Green Nest PG', '101')) expectError(await get(p, 'manager1'), 404, 'NOT_FOUND');
  });

  it("owner 2 gets 404 for owner 1's building, floor, room and bed ids", async () => {
    for (const b of ['Shanti PG', 'Sai Residency']) {
      for (const p of await allPaths(b, '101')) expectError(await get(p, 'owner2'), 404, 'NOT_FOUND');
    }
  });

  it("owner 1 gets 404 for owner 2's ids; manager of Green Nest sees only its own", async () => {
    for (const p of await allPaths('Green Nest PG', '101')) {
      expectError(await get(p, 'owner1'), 404, 'NOT_FOUND');
      expect((await get(p, 'manager3')).status).toBe(200);
    }
    for (const p of await allPaths('Shanti PG', '101')) expectError(await get(p, 'manager3'), 404, 'NOT_FOUND');
  });

  it('own data is reachable (control)', async () => {
    for (const p of await allPaths('Sai Residency', '101')) {
      expect((await get(p, 'manager2')).status).toBe(200);
      expect((await get(p, 'owner1')).status).toBe(200);
    }
  });
});

describe('roles, auth and malformed ids', () => {
  const someIds = async () => ({
    building: B['Shanti PG'], floor: await floorId('Shanti PG', 1),
    room: await roomId('Shanti PG', '101'), bed: await bedId('Shanti PG', '101', 'A'),
  });
  const paths = (ids) => ['/buildings', `/buildings/${ids.building}/floors`, `/floors/${ids.floor}/rooms`, `/rooms/${ids.room}/beds`, `/beds/${ids.bed}`];

  it('admin gets 403 FORBIDDEN on all 5 endpoints', async () => {
    for (const p of paths(await someIds())) expectError(await get(p, 'admin'), 403, 'FORBIDDEN');
  });

  it('no token -> 401 UNAUTHORIZED', async () => {
    for (const p of paths(await someIds())) expectError(await request(app).get(`/api${p}`), 401, 'UNAUTHORIZED');
  });

  it('inactive owner -> 403 ACCOUNT_INACTIVE', async () => {
    await pool.query(`UPDATE owner SET is_active = false WHERE phone = '9000000004'`);
    try {
      expectError(await get('/buildings', 'owner2'), 403, 'ACCOUNT_INACTIVE');
      expectError(await get('/buildings', 'manager3'), 403, 'ACCOUNT_INACTIVE');
    } finally {
      await pool.query(`UPDATE owner SET is_active = true WHERE phone = '9000000004'`);
    }
  });

  it('malformed and unknown ids -> 404 NOT_FOUND', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    for (const bad of ['not-a-uuid', '123', unknown, `${unknown}x`, "1'; DROP TABLE bed;--"]) {
      const id = encodeURIComponent(bad);
      for (const p of paths({ building: id, floor: id, room: id, bed: id }).slice(1)) {
        expectError(await get(p, 'owner1'), 404, 'NOT_FOUND');
        expectError(await get(p, 'manager1'), 404, 'NOT_FOUND');
      }
    }
  });

  it('does not intercept other /api routes', async () => {
    expectError(await request(app).get('/api/nope'), 404, 'NOT_FOUND');
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('efficiency', () => {
  it('each endpoint uses at most 2 queries besides the auth lookup', async () => {
    const m1 = await one(`SELECT id FROM manager WHERE phone = '9000000002'`);
    const ids = {
      building: B['Shanti PG'], floor: await floorId('Shanti PG', 1),
      room: await roomId('Shanti PG', '101'), bed: await bedId('Shanti PG', '101', 'A'),
    };
    expect(m1).toBeTruthy();
    const spy = vi.spyOn(pool, 'query');
    try {
      for (const [p, max] of [['/buildings', 1], [`/buildings/${ids.building}/floors`, 2], [`/floors/${ids.floor}/rooms`, 2], [`/rooms/${ids.room}/beds`, 2], [`/beds/${ids.bed}`, 2]]) {
        for (const who of ['owner1', 'manager1']) {
          spy.mockClear();
          expect((await get(p, who)).status).toBe(200);
          expect(spy.mock.calls.length, `${who} ${p}`).toBeLessThanOrEqual(1 + max);
        }
      }
    } finally {
      spy.mockRestore();
    }
  });
});
