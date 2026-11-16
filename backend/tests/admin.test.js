import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { naturalCompare } from '../src/lib/natural-sort.js';
import { mapDbError } from '../src/routes/admin.js';
import { truncateAll } from './helpers.js';

const SEED = {
  admin: { phone: '9000000000', password: 'admin123' },
  owner1: { phone: '9000000001', password: 'owner123' },
  manager1: { phone: '9000000002', password: 'manager123' },
};
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

let phoneSeq = 0;
const newPhone = () => `8${String(200000000 + ++phoneSeq).slice(-9)}`;

const login = (body) => request(app).post('/api/auth/login').send(body);
let adminToken; let ownerToken; let managerToken;

const as = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
});
const A = () => as(adminToken);

const one = async (q, p) => (await pool.query(q, p)).rows[0];
const expectError = (res, status, code) => {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  expect(res.body).toEqual({ error: { code, message: expect.any(String) } });
};
const expectNoSecrets = (res) => {
  expect(JSON.stringify(res.body)).not.toMatch(/password_hash|current_code_hash|\$2[aby]\$/);
};

async function makeOwner(extra = {}) {
  const body = { name: 'Owner X', phone: newPhone(), password: 'secret1', ...extra };
  const res = await A().post('/api/admin/owners', body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { ...res.body.owner, password: body.password };
}
async function makeBuilding(ownerId, extra = {}) {
  const res = await A().post(`/api/admin/owners/${ownerId}/buildings`, { name: 'Bldg', ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.building;
}
async function makeFloor(buildingId, floor_number = 1) {
  const res = await A().post(`/api/admin/buildings/${buildingId}/floors`, { floor_number });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.floor;
}
async function makeManager(buildingId, extra = {}) {
  const body = { name: 'Mgr', phone: newPhone(), password: 'secret1', ...extra };
  const res = await A().post(`/api/admin/buildings/${buildingId}/manager`, body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { ...res.body.manager, password: body.password };
}

beforeAll(async () => {
  await truncateAll();
  await seed();
  adminToken = (await login(SEED.admin)).body.token;
  ownerToken = (await login(SEED.owner1)).body.token;
  managerToken = (await login(SEED.manager1)).body.token;
});
afterAll(() => pool.end());

describe('role guard', () => {
  const calls = [
    ['get', '/api/admin/owners'],
    ['post', '/api/admin/owners', { name: 'X', phone: '8999999999', password: 'secret1' }],
    ['patch', `/api/admin/owners/${UNKNOWN}`, { name: 'X' }],
    ['get', `/api/admin/owners/${UNKNOWN}/buildings`],
    ['post', `/api/admin/owners/${UNKNOWN}/buildings`, { name: 'X' }],
    ['patch', `/api/admin/buildings/${UNKNOWN}`, { name: 'X' }],
    ['post', `/api/admin/buildings/${UNKNOWN}/floors`, { floor_number: 1 }],
    ['post', `/api/admin/floors/${UNKNOWN}/rooms`, { room_number: '1', bed_capacity: 2 }],
    ['post', `/api/admin/buildings/${UNKNOWN}/manager`, { name: 'X', phone: '8999999998', password: 'secret1' }],
    ['patch', `/api/admin/managers/${UNKNOWN}`, { name: 'X' }],
  ];

  for (const [method, url, body] of calls) {
    it(`${method.toUpperCase()} ${url.replace(UNKNOWN, ':id')}: owner and manager get 403, no token 401`, async () => {
      expectError(await as(ownerToken)[method](url, body), 403, 'FORBIDDEN');
      expectError(await as(managerToken)[method](url, body), 403, 'FORBIDDEN');
      expectError(await request(app)[method](url).send(body), 401, 'UNAUTHORIZED');
    });
  }

  it('non-admin calls change nothing', async () => {
    const before = await one('SELECT count(*)::int AS n FROM owner');
    await as(ownerToken).post('/api/admin/owners', { name: 'X', phone: newPhone(), password: 'secret1' });
    expect(await one('SELECT count(*)::int AS n FROM owner')).toEqual(before);
  });
});

describe('owners', () => {
  it('POST creates an owner who can log in; hash stored with bcrypt cost 10', async () => {
    const body = { name: '  Asha Kulkarni ', phone: newPhone(), password: 'pass123' };
    const res = await A().post('/api/admin/owners', body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ owner: { id: expect.any(String), name: 'Asha Kulkarni', phone: body.phone, is_active: true } });
    expectNoSecrets(res);

    const row = await one('SELECT password_hash FROM owner WHERE id = $1', [res.body.owner.id]);
    expect(row.password_hash).toMatch(/^\$2[aby]\$10\$/);
    const l = await login({ phone: body.phone, password: body.password });
    expect(l.status).toBe(200);
    expect(l.body.user).toMatchObject({ role: 'owner', owner_id: res.body.owner.id });
  });

  it('GET lists owners sorted by name with building_count', async () => {
    const o = await makeOwner({ name: 'Aaaa First' });
    await makeBuilding(o.id);
    await makeBuilding(o.id);
    const res = await A().get('/api/admin/owners');
    expect(res.status).toBe(200);
    expectNoSecrets(res);
    const names = res.body.owners.map((x) => x.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(res.body.owners[0]).toEqual({ id: o.id, name: 'Aaaa First', phone: o.phone, is_active: true, building_count: 2 });
    const ramesh = res.body.owners.find((x) => x.phone === SEED.owner1.phone);
    expect(ramesh.building_count).toBe(2);
    const fresh = await makeOwner();
    const res2 = await A().get('/api/admin/owners');
    expect(res2.body.owners.find((x) => x.id === fresh.id).building_count).toBe(0);
  });

  it('PATCH updates name and password', async () => {
    const o = await makeOwner();
    const res = await A().patch(`/api/admin/owners/${o.id}`, { name: 'Renamed', password: 'newpass1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ owner: { id: o.id, name: 'Renamed', phone: o.phone, is_active: true } });
    expectNoSecrets(res);
    expect((await login({ phone: o.phone, password: o.password })).status).toBe(401);
    expect((await login({ phone: o.phone, password: 'newpass1' })).status).toBe(200);
  });

  it('switching an owner off blocks login, old tokens and their managers; on again restores', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    const m = await makeManager(b.id);
    const oldToken = (await login(o)).body.token;

    const off = await A().patch(`/api/admin/owners/${o.id}`, { is_active: false });
    expect(off.status).toBe(200);
    expect(off.body.owner.is_active).toBe(false);
    expectError(await login(o), 403, 'ACCOUNT_INACTIVE');
    expectError(await login(m), 403, 'ACCOUNT_INACTIVE');
    expectError(await as(oldToken).get('/api/auth/me'), 403, 'ACCOUNT_INACTIVE');

    // Admin can still see and manage the inactive owner's buildings (D-20).
    const tree = await A().get(`/api/admin/owners/${o.id}/buildings`);
    expect(tree.status).toBe(200);
    expect(tree.body.buildings).toHaveLength(1);

    const on = await A().patch(`/api/admin/owners/${o.id}`, { is_active: true });
    expect(on.body.owner.is_active).toBe(true);
    expect((await login(o)).status).toBe(200);
    expect((await login(m)).status).toBe(200);
  });

  it('validation errors → 400', async () => {
    const bad = [
      {},
      { name: '', phone: newPhone(), password: 'secret1' },
      { name: 'x'.repeat(101), phone: newPhone(), password: 'secret1' },
      { name: 'X', phone: '12345', password: 'secret1' },
      { name: 'X', phone: '5123456789', password: 'secret1' },
      { name: 'X', phone: newPhone(), password: '12345' },
      { name: 'X', phone: newPhone(), password: 'x'.repeat(101) },
      { name: 'X', phone: 9123456789, password: 'secret1' },
    ];
    for (const body of bad) expectError(await A().post('/api/admin/owners', body), 400, 'VALIDATION_ERROR');

    const o = await makeOwner();
    for (const body of [{}, { is_active: 'no' }, { name: '' }, { password: '123' }]) {
      expectError(await A().patch(`/api/admin/owners/${o.id}`, body), 400, 'VALIDATION_ERROR');
    }
  });

  it('unknown or malformed ids → 404', async () => {
    expectError(await A().patch(`/api/admin/owners/${UNKNOWN}`, { name: 'X' }), 404, 'NOT_FOUND');
    expectError(await A().patch('/api/admin/owners/not-a-uuid', { name: 'X' }), 404, 'NOT_FOUND');
  });
});

describe('phone uniqueness across admin, owner and manager', () => {
  it('new owner with an admin, owner or manager phone → 409 PHONE_TAKEN', async () => {
    for (const phone of [SEED.admin.phone, SEED.owner1.phone, SEED.manager1.phone]) {
      expectError(await A().post('/api/admin/owners', { name: 'Dup', phone, password: 'secret1' }), 409, 'PHONE_TAKEN');
    }
  });

  it('new manager with an admin, owner or manager phone → 409 PHONE_TAKEN', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    for (const phone of [SEED.admin.phone, o.phone, SEED.manager1.phone]) {
      expectError(await A().post(`/api/admin/buildings/${b.id}/manager`, { name: 'Dup', phone, password: 'secret1' }), 409, 'PHONE_TAKEN');
    }
    expect(await one('SELECT count(*)::int AS n FROM manager WHERE building_id = $1', [b.id])).toEqual({ n: 0 });
  });

  it('PATCH manager phone to a taken phone → 409; to its own phone is fine', async () => {
    const o = await makeOwner();
    const m = await makeManager((await makeBuilding(o.id)).id);
    expectError(await A().patch(`/api/admin/managers/${m.id}`, { phone: o.phone }), 409, 'PHONE_TAKEN');
    expectError(await A().patch(`/api/admin/managers/${m.id}`, { phone: SEED.admin.phone }), 409, 'PHONE_TAKEN');
    const same = await A().patch(`/api/admin/managers/${m.id}`, { phone: m.phone });
    expect(same.status).toBe(200);
  });

  it('parallel creates with the same phone: exactly one succeeds', async () => {
    const phone = newPhone();
    const results = await Promise.all([1, 2, 3].map(() => A().post('/api/admin/owners', { name: 'Race', phone, password: 'secret1' })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe('PHONE_TAKEN');
  });

  it('parallel owner + manager with the same phone (different tables): exactly one succeeds', async () => {
    const o = await makeOwner();
    for (let i = 0; i < 5; i += 1) {
      const phone = newPhone();
      const b2 = await makeBuilding(o.id);
      const results = await Promise.all([
        A().post('/api/admin/owners', { name: 'Race', phone, password: 'secret1' }),
        A().post(`/api/admin/buildings/${b2.id}/manager`, { name: 'Race', phone, password: 'secret1' }),
      ]);
      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(1);
      const n = await one(`SELECT (SELECT count(*) FROM owner WHERE phone = $1) + (SELECT count(*) FROM manager WHERE phone = $1) AS n`, [phone]);
      expect(Number(n.n)).toBe(1);
    }
  });

  it('DB unique violation is mapped to PHONE_TAKEN as a fallback', async () => {
    expect(mapDbError({ cause: { code: '23505', constraint: 'owner_phone_unique' } })).toMatchObject({ status: 409, code: 'PHONE_TAKEN' });
    expect(mapDbError({ code: '23505', constraint: 'manager_building_id_unique' })).toMatchObject({ status: 409, code: 'MANAGER_EXISTS' });
    expect(mapDbError({ code: '23505', constraint: 'room_floor_number_uq' })).toMatchObject({ status: 409, code: 'CONFLICT' });
    const other = new Error('x');
    expect(mapDbError(other)).toBe(other);
  });
});

describe('buildings and structure', () => {
  it('POST building with defaults and with address/photo', async () => {
    const o = await makeOwner();
    const r1 = await A().post(`/api/admin/owners/${o.id}/buildings`, { name: 'Plain' });
    expect(r1.status).toBe(201);
    expect(r1.body).toEqual({ building: { id: expect.any(String), owner_id: o.id, name: 'Plain', address: null, photo_url: null } });

    const r2 = await A().post(`/api/admin/owners/${o.id}/buildings`, {
      name: 'Full', address: 'Kothrud, Pune', photo_url: 'https://example.com/p.jpg',
    });
    expect(r2.body.building).toMatchObject({ address: 'Kothrud, Pune', photo_url: 'https://example.com/p.jpg' });
  });

  it('building validation → 400 and unknown owner → 404', async () => {
    const o = await makeOwner();
    const url = `/api/admin/owners/${o.id}/buildings`;
    for (const body of [
      {}, { name: '' }, { name: 'X', address: 'a'.repeat(201) },
      { name: 'X', photo_url: 'http://example.com/p.jpg' }, { name: 'X', photo_url: 'not a url' },
      { name: 'X', photo_url: `https://e.com/${'a'.repeat(490)}` },
    ]) expectError(await A().post(url, body), 400, 'VALIDATION_ERROR');
    expectError(await A().post(`/api/admin/owners/${UNKNOWN}/buildings`, { name: 'X' }), 404, 'NOT_FOUND');
    expectError(await A().get(`/api/admin/owners/${UNKNOWN}/buildings`), 404, 'NOT_FOUND');
    expectError(await A().get('/api/admin/owners/bad/buildings'), 404, 'NOT_FOUND');
  });

  it('PATCH building updates fields, clears photo with null; unknown → 404', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id, { photo_url: 'https://e.com/a.jpg' });
    const res = await A().patch(`/api/admin/buildings/${b.id}`, { name: 'New Name', address: 'Baner', photo_url: null });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ building: { id: b.id, owner_id: o.id, name: 'New Name', address: 'Baner', photo_url: null } });
    expectError(await A().patch(`/api/admin/buildings/${b.id}`, {}), 400, 'VALIDATION_ERROR');
    expectError(await A().patch(`/api/admin/buildings/${b.id}`, { photo_url: 'ftp://x' }), 400, 'VALIDATION_ERROR');
    expectError(await A().patch(`/api/admin/buildings/${UNKNOWN}`, { name: 'X' }), 404, 'NOT_FOUND');
  });

  it('POST floor; duplicate → 409 CONFLICT; ground floor 0 allowed; bad input → 400; unknown → 404', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    const res = await A().post(`/api/admin/buildings/${b.id}/floors`, { floor_number: 0 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ floor: { id: expect.any(String), building_id: b.id, floor_number: 0 } });
    expectError(await A().post(`/api/admin/buildings/${b.id}/floors`, { floor_number: 0 }), 409, 'CONFLICT');
    // Same number in another building is fine.
    const b2 = await makeBuilding(o.id);
    expect((await A().post(`/api/admin/buildings/${b2.id}/floors`, { floor_number: 0 })).status).toBe(201);

    for (const body of [{}, { floor_number: -1 }, { floor_number: 201 }, { floor_number: 1.5 }, { floor_number: '1' }]) {
      expectError(await A().post(`/api/admin/buildings/${b.id}/floors`, body), 400, 'VALIDATION_ERROR');
    }
    expectError(await A().post(`/api/admin/buildings/${UNKNOWN}/floors`, { floor_number: 1 }), 404, 'NOT_FOUND');
  });

  it('POST room with capacity 3 creates beds A/B/C; capacity 2 creates A/B', async () => {
    const o = await makeOwner();
    const f = await makeFloor((await makeBuilding(o.id)).id);
    const r3 = await A().post(`/api/admin/floors/${f.id}/rooms`, { room_number: '101', bed_capacity: 3 });
    expect(r3.status).toBe(201);
    expect(r3.body).toEqual({
      room: { id: expect.any(String), floor_id: f.id, room_number: '101', bed_capacity: 3 },
      beds: [
        { id: expect.any(String), bed_label: 'A' },
        { id: expect.any(String), bed_label: 'B' },
        { id: expect.any(String), bed_label: 'C' },
      ],
    });
    const dbBeds = await pool.query('SELECT bed_label FROM bed WHERE room_id = $1 ORDER BY bed_label', [r3.body.room.id]);
    expect(dbBeds.rows.map((x) => x.bed_label)).toEqual(['A', 'B', 'C']);

    const r2 = await A().post(`/api/admin/floors/${f.id}/rooms`, { room_number: '102', bed_capacity: 2 });
    expect(r2.body.beds.map((x) => x.bed_label)).toEqual(['A', 'B']);
  });

  it('duplicate room on a floor → 409 CONFLICT and no extra beds; bad input → 400; unknown floor → 404', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    const f = await makeFloor(b.id, 1);
    const f2 = await makeFloor(b.id, 2);
    await A().post(`/api/admin/floors/${f.id}/rooms`, { room_number: '101', bed_capacity: 2 });
    expectError(await A().post(`/api/admin/floors/${f.id}/rooms`, { room_number: '101', bed_capacity: 3 }), 409, 'CONFLICT');
    const n = await one('SELECT count(*)::int AS n FROM bed bd JOIN room r ON r.id = bd.room_id WHERE r.floor_id = $1', [f.id]);
    expect(n.n).toBe(2);
    expect((await A().post(`/api/admin/floors/${f2.id}/rooms`, { room_number: '101', bed_capacity: 2 })).status).toBe(201);

    for (const body of [
      {}, { room_number: '', bed_capacity: 2 }, { room_number: '12345678901', bed_capacity: 2 },
      { room_number: '1', bed_capacity: 1 }, { room_number: '1', bed_capacity: 4 }, { room_number: '1', bed_capacity: '2' },
      { room_number: 101, bed_capacity: 2 },
    ]) expectError(await A().post(`/api/admin/floors/${f.id}/rooms`, body), 400, 'VALIDATION_ERROR');
    expectError(await A().post(`/api/admin/floors/${UNKNOWN}/rooms`, { room_number: '1', bed_capacity: 2 }), 404, 'NOT_FOUND');
  });

  it('GET tree: buildings with manager, floors by number, rooms in natural order', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id, { name: 'Shanti', address: 'Kothrud' });
    const empty = await makeBuilding(o.id, { name: 'Zed Empty' });
    const f2 = await makeFloor(b.id, 2);
    const f1 = await makeFloor(b.id, 1);
    for (const rn of ['10', '2', '1', 'G10', 'G2']) {
      await A().post(`/api/admin/floors/${f1.id}/rooms`, { room_number: rn, bed_capacity: 2 });
    }
    await A().post(`/api/admin/floors/${f2.id}/rooms`, { room_number: '201', bed_capacity: 3 });
    const m = await makeManager(b.id, { name: 'Suresh' });

    const res = await A().get(`/api/admin/owners/${o.id}/buildings`);
    expect(res.status).toBe(200);
    expectNoSecrets(res);
    const [first, second] = res.body.buildings;
    expect(first).toMatchObject({
      id: b.id, name: 'Shanti', address: 'Kothrud', photo_url: null,
      manager: { id: m.id, name: 'Suresh', phone: m.phone, is_active: true },
    });
    expect(Object.keys(first.manager).sort()).toEqual(['id', 'is_active', 'name', 'phone']);
    expect(first.floors.map((x) => x.floor_number)).toEqual([1, 2]);
    expect(first.floors[0].rooms.map((x) => x.room_number)).toEqual(['1', '2', '10', 'G2', 'G10']);
    expect(first.floors[1].rooms).toEqual([{ id: expect.any(String), room_number: '201', bed_capacity: 3 }]);
    expect(second).toEqual({ id: empty.id, name: 'Zed Empty', address: null, photo_url: null, manager: null, floors: [] });
  });

  it('GET tree for an owner with no buildings is an empty list', async () => {
    const o = await makeOwner();
    const res = await A().get(`/api/admin/owners/${o.id}/buildings`);
    expect(res.body).toEqual({ buildings: [] });
  });

  it('naturalCompare orders numbers inside text', () => {
    expect(['10', '9', '1', 'A2', 'A10', '101', '20'].sort(naturalCompare)).toEqual(['1', '9', '10', '20', '101', 'A2', 'A10']);
  });
});

describe('managers', () => {
  it('POST creates a manager who can log in, scoped to the building owner, no season code', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    const res = await A().post(`/api/admin/buildings/${b.id}/manager`, { name: 'Kiran', phone: newPhone(), password: 'secret1' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ manager: {
      id: expect.any(String), building_id: b.id, name: 'Kiran', phone: res.body.manager.phone,
      is_active: true, has_season_code: false,
    } });
    expectNoSecrets(res);
    const row = await one('SELECT owner_id, password_hash, current_code_hash FROM manager WHERE id = $1', [res.body.manager.id]);
    expect(row.owner_id).toBe(o.id);
    expect(row.current_code_hash).toBeNull();
    expect(row.password_hash).toMatch(/^\$2[aby]\$10\$/);

    const l = await login({ phone: res.body.manager.phone, password: 'secret1' });
    expect(l.status).toBe(200);
    expect(l.body.user).toMatchObject({ role: 'manager', owner_id: o.id, building_id: b.id });
  });

  it('second manager for a building → 409 MANAGER_EXISTS', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    await makeManager(b.id);
    expectError(await A().post(`/api/admin/buildings/${b.id}/manager`, { name: 'Two', phone: newPhone(), password: 'secret1' }), 409, 'MANAGER_EXISTS');
  });

  it('parallel second-manager creates: exactly one succeeds', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    const results = await Promise.all([1, 2].map(() =>
      A().post(`/api/admin/buildings/${b.id}/manager`, { name: 'Race', phone: newPhone(), password: 'secret1' })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('manager validation → 400; unknown building → 404', async () => {
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    for (const body of [{}, { name: 'X', phone: '123', password: 'secret1' }, { name: 'X', phone: newPhone(), password: 'short' }]) {
      expectError(await A().post(`/api/admin/buildings/${b.id}/manager`, body), 400, 'VALIDATION_ERROR');
    }
    expectError(await A().post(`/api/admin/buildings/${UNKNOWN}/manager`, { name: 'X', phone: newPhone(), password: 'secret1' }), 404, 'NOT_FOUND');
  });

  it('PATCH replaces name, phone and password; has_season_code reflects the stored code', async () => {
    const o = await makeOwner();
    const m = await makeManager((await makeBuilding(o.id)).id);
    const phone = newPhone();
    const res = await A().patch(`/api/admin/managers/${m.id}`, { name: 'New Person', phone, password: 'fresh12' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ manager: {
      id: m.id, building_id: m.building_id, name: 'New Person', phone, is_active: true, has_season_code: false,
    } });
    expectNoSecrets(res);
    expect((await login({ phone: m.phone, password: m.password })).status).toBe(401);
    expect((await login({ phone, password: 'fresh12' })).status).toBe(200);

    await pool.query("UPDATE manager SET current_code_hash = 'x' WHERE id = $1", [m.id]);
    const r2 = await A().patch(`/api/admin/managers/${m.id}`, { name: 'Again' });
    expect(r2.body.manager.has_season_code).toBe(true);
    expectNoSecrets(r2);
  });

  it('PATCH is_active false blocks the manager login; true restores it', async () => {
    const o = await makeOwner();
    const m = await makeManager((await makeBuilding(o.id)).id);
    const off = await A().patch(`/api/admin/managers/${m.id}`, { is_active: false });
    expect(off.body.manager.is_active).toBe(false);
    expectError(await login(m), 403, 'ACCOUNT_INACTIVE');
    await A().patch(`/api/admin/managers/${m.id}`, { is_active: true });
    expect((await login(m)).status).toBe(200);
  });

  it('PATCH validation → 400; unknown or malformed id → 404', async () => {
    const o = await makeOwner();
    const m = await makeManager((await makeBuilding(o.id)).id);
    for (const body of [{}, { phone: '1' }, { is_active: 1 }, { password: 'x' }, { name: '' }]) {
      expectError(await A().patch(`/api/admin/managers/${m.id}`, body), 400, 'VALIDATION_ERROR');
    }
    expectError(await A().patch(`/api/admin/managers/${UNKNOWN}`, { name: 'X' }), 404, 'NOT_FOUND');
    expectError(await A().patch('/api/admin/managers/123', { name: 'X' }), 404, 'NOT_FOUND');
  });
});

describe('admin never touches tenant data', () => {
  it('admin endpoints leave tenant, payment and transaction_log untouched', async () => {
    const count = async () => one(`SELECT
      (SELECT count(*)::int FROM tenant) t, (SELECT count(*)::int FROM payment) p, (SELECT count(*)::int FROM transaction_log) l`);
    const before = await count();
    const o = await makeOwner();
    const b = await makeBuilding(o.id);
    const f = await makeFloor(b.id);
    await A().post(`/api/admin/floors/${f.id}/rooms`, { room_number: '1', bed_capacity: 3 });
    await makeManager(b.id);
    await A().patch(`/api/admin/owners/${o.id}`, { is_active: false });
    expect(await count()).toEqual(before);
  });
});
