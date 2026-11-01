import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app as realApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { truncateAll } from './helpers.js';
import { assertBuildingAccess } from '../src/lib/scope.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errors.js';

let B; // building ids by name
let U; // req.user-like objects
const one = async (q, p) => (await pool.query(q, p)).rows[0];

beforeAll(async () => {
  await truncateAll();
  await seed();
  const { rows } = await pool.query('SELECT id, name FROM building');
  B = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  const o1 = await one(`SELECT id FROM owner WHERE phone = '9000000001'`);
  const o2 = await one(`SELECT id FROM owner WHERE phone = '9000000004'`);
  const m1 = await one(`SELECT id, owner_id, building_id FROM manager WHERE phone = '9000000002'`);
  const ad = await one(`SELECT id FROM admin`);
  U = {
    admin: { id: ad.id, role: 'admin', owner_id: null, building_id: null },
    owner1: { id: o1.id, role: 'owner', owner_id: o1.id, building_id: null },
    owner2: { id: o2.id, role: 'owner', owner_id: o2.id, building_id: null },
    manager1: { id: m1.id, role: 'manager', ...m1 },
  };
});
afterAll(() => pool.end());

const expectNotFound = async (p) => {
  await expect(p).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
};

describe('assertBuildingAccess', () => {
  it('owner can access own buildings', async () => {
    await expect(assertBuildingAccess(U.owner1, B['Shanti PG'])).resolves.toMatchObject({ id: B['Shanti PG'] });
    await expect(assertBuildingAccess(U.owner1, B['Sai Residency'])).resolves.toMatchObject({ owner_id: U.owner1.id });
  });

  it("owner 2 cannot access owner 1's building -> 404", async () => {
    await expectNotFound(assertBuildingAccess(U.owner2, B['Shanti PG']));
    await expectNotFound(assertBuildingAccess(U.owner1, B['Green Nest PG']));
  });

  it('manager can access only their own building', async () => {
    expect(U.manager1.building_id).toBe(B['Shanti PG']);
    await expect(assertBuildingAccess(U.manager1, B['Shanti PG'])).resolves.toMatchObject({ id: B['Shanti PG'] });
  });

  it('manager cannot access another building of the same owner -> 404', async () => {
    await expectNotFound(assertBuildingAccess(U.manager1, B['Sai Residency']));
  });

  it("manager cannot access another owner's building -> 404", async () => {
    await expectNotFound(assertBuildingAccess(U.manager1, B['Green Nest PG']));
  });

  it('admin can access any building', async () => {
    for (const id of Object.values(B)) await expect(assertBuildingAccess(U.admin, id)).resolves.toMatchObject({ id });
  });

  it('admin can access buildings of an inactive owner (D-20); the owner check is done by requireAuth', async () => {
    await pool.query(`UPDATE owner SET is_active = false WHERE id = $1`, [U.owner2.id]);
    try {
      await expect(assertBuildingAccess(U.admin, B['Green Nest PG'])).resolves.toMatchObject({ id: B['Green Nest PG'] });
    } finally {
      await pool.query(`UPDATE owner SET is_active = true WHERE id = $1`, [U.owner2.id]);
    }
  });

  it('unknown or malformed building id -> 404 (no DB error)', async () => {
    await expectNotFound(assertBuildingAccess(U.admin, '00000000-0000-4000-8000-000000000000'));
    await expectNotFound(assertBuildingAccess(U.admin, 'not-a-uuid'));
    await expectNotFound(assertBuildingAccess(U.owner1, undefined));
    await expectNotFound(assertBuildingAccess(undefined, B['Shanti PG']));
  });

  it('404 for a foreign building looks the same as for a missing one', async () => {
    const foreign = await assertBuildingAccess(U.owner2, B['Shanti PG']).catch((e) => e);
    const missing = await assertBuildingAccess(U.owner2, '00000000-0000-4000-8000-000000000000').catch((e) => e);
    expect(foreign.message).toBe(missing.message);
  });
});

describe('middleware through HTTP (requireAuth + requireRole + scope)', () => {
  // A throwaway router that mimics a later endpoint.
  const test = express();
  test.get('/b/:id', requireAuth, requireRole('owner', 'manager'), async (req, res, next) => {
    try {
      await assertBuildingAccess(req.user, req.params.id);
      res.json({ user: req.user });
    } catch (e) { next(e); }
  });
  test.use(errorHandler);

  const tokenFor = async (phone, password) =>
    (await request(realApp).post('/api/auth/login').send({ phone, password })).body.token;
  const get = (id, token) => request(test).get(`/b/${id}`).set('Authorization', `Bearer ${token}`);

  it('attaches req.user = { id, role, owner_id, building_id } only', async () => {
    const res = await get(B['Shanti PG'], await tokenFor('9000000002', 'manager123'));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: U.manager1.id, role: 'manager', owner_id: U.manager1.owner_id, building_id: U.manager1.building_id,
    });
  });

  it('wrong role -> 403 FORBIDDEN', async () => {
    const res = await get(B['Shanti PG'], await tokenFor('9000000000', 'admin123'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('cross-owner request -> 404 NOT_FOUND', async () => {
    const res = await get(B['Shanti PG'], await tokenFor('9000000004', 'owner123'));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Building not found' } });
  });

  it('cross-building request by a manager -> 404 NOT_FOUND', async () => {
    const res = await get(B['Sai Residency'], await tokenFor('9000000002', 'manager123'));
    expect(res.status).toBe(404);
  });
});

describe('requireRole without requireAuth', () => {
  it('returns 401 when no user is attached', async () => {
    const a = express();
    a.get('/x', requireRole('admin'), (_q, r) => r.json({}));
    a.use(errorHandler);
    const res = await request(a).get('/x');
    expect(res.status).toBe(401);
  });
});
