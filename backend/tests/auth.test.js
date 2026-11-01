import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { truncateAll } from './helpers.js';

const SEED = {
  admin: { phone: '9000000000', password: 'admin123' },
  owner1: { phone: '9000000001', password: 'owner123' },
  manager1: { phone: '9000000002', password: 'manager123' }, // Shanti PG, owner 1
  manager2: { phone: '9000000003', password: 'manager123' }, // Sai Residency, owner 1
  owner2: { phone: '9000000004', password: 'owner123' },
};

const login = (body) => request(app).post('/api/auth/login').send(body);
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const tokenFor = async (who) => (await login(SEED[who])).body.token;
const one = async (q, p) => (await pool.query(q, p)).rows[0];
const setOwnerActive = (phone, on) => pool.query('UPDATE owner SET is_active = $2 WHERE phone = $1', [phone, on]);
const setManagerActive = (phone, on) => pool.query('UPDATE manager SET is_active = $2 WHERE phone = $1', [phone, on]);
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: { code, message: expect.any(String) } });
};
const expectNoSecrets = (res) => {
  const text = JSON.stringify(res.body);
  expect(text).not.toMatch(/password_hash|current_code_hash|\$2[aby]\$/);
};

beforeAll(async () => { await truncateAll(); await seed(); });
afterEach(async () => {
  await setOwnerActive(SEED.owner1.phone, true);
  await setManagerActive(SEED.manager1.phone, true);
});
afterAll(() => pool.end());

describe('GET /api/health', () => {
  it('returns ok without a token', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /api/auth/login', () => {
  it('admin logs in with null owner and building', async () => {
    const res = await login(SEED.admin);
    const a = await one('SELECT id, name FROM admin WHERE phone = $1', [SEED.admin.phone]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: expect.any(String),
      user: { id: a.id, name: a.name, role: 'admin', owner_id: null, building_id: null },
    });
    expectNoSecrets(res);
  });

  it('owner logs in with owner_id = own id and null building', async () => {
    const res = await login(SEED.owner1);
    const o = await one('SELECT id, name FROM owner WHERE phone = $1', [SEED.owner1.phone]);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: o.id, name: 'Ramesh Patil', role: 'owner', owner_id: o.id, building_id: null });
    expectNoSecrets(res);
  });

  it('manager logs in with owner and building set', async () => {
    const res = await login(SEED.manager1);
    const m = await one('SELECT id, name, owner_id, building_id FROM manager WHERE phone = $1', [SEED.manager1.phone]);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: m.id, name: m.name, role: 'manager', owner_id: m.owner_id, building_id: m.building_id });
    expectNoSecrets(res);
  });

  it('token payload is only { sub, role } plus standard claims', async () => {
    const res = await login(SEED.manager1);
    const p = jwt.decode(res.body.token);
    expect(p.sub).toBe(res.body.user.id);
    expect(p.role).toBe('manager');
    expect(Object.keys(p).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
    expect(p.exp - p.iat).toBe(30 * 24 * 3600); // default JWT_EXPIRES_IN 30d
  });

  it('wrong password -> 401 INVALID_CREDENTIALS', async () => {
    expectError(await login({ phone: SEED.owner1.phone, password: 'nope' }), 401, 'INVALID_CREDENTIALS');
  });

  it('unknown phone -> the same 401 with the same message', async () => {
    const wrongPw = await login({ phone: SEED.owner1.phone, password: 'nope' });
    const unknown = await login({ phone: '9876543210', password: 'owner123' });
    expectError(unknown, 401, 'INVALID_CREDENTIALS');
    expect(unknown.body).toEqual(wrongPw.body);
  });

  it.each([
    ['missing body', undefined],
    ['missing password', { phone: '9000000001' }],
    ['missing phone', { password: 'owner123' }],
    ['phone too short', { phone: '900000000', password: 'x' }],
    ['phone starts with 5', { phone: '5000000001', password: 'x' }],
    ['phone with +91', { phone: '+919000000001', password: 'x' }],
    ['phone as number', { phone: 9000000001, password: 'x' }],
    ['empty password', { phone: '9000000001', password: '' }],
    ['password over 100 chars', { phone: '9000000001', password: 'a'.repeat(101) }],
  ])('invalid body (%s) -> 400 VALIDATION_ERROR', async (_label, body) => {
    expectError(await login(body), 400, 'VALIDATION_ERROR');
  });

  it('malformed JSON -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"phone":');
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('inactive owner -> 403 ACCOUNT_INACTIVE for the owner and all their managers', async () => {
    await setOwnerActive(SEED.owner1.phone, false);
    expectError(await login(SEED.owner1), 403, 'ACCOUNT_INACTIVE');
    expectError(await login(SEED.manager1), 403, 'ACCOUNT_INACTIVE');
    expectError(await login(SEED.manager2), 403, 'ACCOUNT_INACTIVE');
    // other owner and admin are unaffected
    expect((await login(SEED.owner2)).status).toBe(200);
    expect((await login(SEED.admin)).status).toBe(200);
  });

  it('inactive owner with a wrong password still gets 401 (no account hint)', async () => {
    await setOwnerActive(SEED.owner1.phone, false);
    expectError(await login({ phone: SEED.owner1.phone, password: 'nope' }), 401, 'INVALID_CREDENTIALS');
  });

  it('inactive manager -> 403 ACCOUNT_INACTIVE', async () => {
    await setManagerActive(SEED.manager1.phone, false);
    expectError(await login(SEED.manager1), 403, 'ACCOUNT_INACTIVE');
    expect((await login(SEED.manager2)).status).toBe(200);
  });

  it('locked manager can still log in (viewing stays open, D-01)', async () => {
    await pool.query('UPDATE manager SET is_locked = true, failed_attempts = 3 WHERE phone = $1', [SEED.manager2.phone]);
    try {
      expect((await login(SEED.manager2)).status).toBe(200);
    } finally {
      await pool.query('UPDATE manager SET is_locked = false, failed_attempts = 0 WHERE phone = $1', [SEED.manager2.phone]);
    }
  });
});

describe('GET /api/auth/me', () => {
  it('returns the same user shape as login for each role', async () => {
    for (const who of ['admin', 'owner1', 'manager1']) {
      const l = await login(SEED[who]);
      const res = await me(l.body.token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: l.body.user });
      expectNoSecrets(res);
    }
  });

  it('no token -> 401 UNAUTHORIZED', async () => {
    expectError(await request(app).get('/api/auth/me'), 401, 'UNAUTHORIZED');
  });

  it.each([
    ['garbage', 'not-a-jwt'],
    ['wrong scheme', null],
  ])('bad token (%s) -> 401 UNAUTHORIZED', async (label, token) => {
    const req = request(app).get('/api/auth/me');
    const res = label === 'wrong scheme'
      ? await req.set('Authorization', `Basic ${await tokenFor('owner1')}`)
      : await req.set('Authorization', `Bearer ${token}`);
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('token signed with another secret -> 401', async () => {
    const real = jwt.decode(await tokenFor('owner1'));
    const forged = jwt.sign({ role: 'owner' }, 'other-secret', { subject: real.sub });
    expectError(await me(forged), 401, 'UNAUTHORIZED');
  });

  it('unsigned (alg none) token -> 401', async () => {
    const real = jwt.decode(await tokenFor('owner1'));
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: real.sub, role: 'admin' })}.`;
    expectError(await me(none), 401, 'UNAUTHORIZED');
  });

  it('expired token -> 401', async () => {
    const real = jwt.decode(await tokenFor('owner1'));
    const expired = jwt.sign({ role: 'owner', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, { subject: real.sub });
    expectError(await me(expired), 401, 'UNAUTHORIZED');
  });

  it('role in token cannot be swapped to escalate (owner id claimed as admin) -> 401', async () => {
    const real = jwt.decode(await tokenFor('owner1'));
    const swapped = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { subject: real.sub });
    expectError(await me(swapped), 401, 'UNAUTHORIZED');
  });

  it('unknown role or non-uuid subject -> 401', async () => {
    const real = jwt.decode(await tokenFor('owner1'));
    expectError(await me(jwt.sign({ role: 'superuser' }, process.env.JWT_SECRET, { subject: real.sub })), 401, 'UNAUTHORIZED');
    expectError(await me(jwt.sign({ role: 'owner' }, process.env.JWT_SECRET, { subject: 'abc' })), 401, 'UNAUTHORIZED');
  });

  it('user deleted after login -> 401', async () => {
    await pool.query(`INSERT INTO admin (name, phone, password_hash) VALUES ('Temp', '9111111111', $1)`, [bcrypt.hashSync('temp123', 4)]);
    const token = (await login({ phone: '9111111111', password: 'temp123' })).body.token;
    expect((await me(token)).status).toBe(200);
    await pool.query(`DELETE FROM admin WHERE phone = '9111111111'`);
    expectError(await me(token), 401, 'UNAUTHORIZED');
  });

  it('owner switched off after login: owner and managers get 403 with their old tokens', async () => {
    const tokens = { owner1: await tokenFor('owner1'), manager1: await tokenFor('manager1'), manager2: await tokenFor('manager2') };
    await setOwnerActive(SEED.owner1.phone, false);
    for (const t of Object.values(tokens)) expectError(await me(t), 403, 'ACCOUNT_INACTIVE');
    await setOwnerActive(SEED.owner1.phone, true);
    for (const t of Object.values(tokens)) expect((await me(t)).status).toBe(200);
  });

  it('manager switched off after login -> 403 with old token', async () => {
    const t = await tokenFor('manager1');
    await setManagerActive(SEED.manager1.phone, false);
    expectError(await me(t), 403, 'ACCOUNT_INACTIVE');
  });

  it('owner and building come from the DB, not the token', async () => {
    // A change in the DB after login is visible on the next request with the same token
    const t = await tokenFor('owner1');
    await pool.query(`UPDATE owner SET name = 'Ramesh P' WHERE phone = $1`, [SEED.owner1.phone]);
    try {
      expect((await me(t)).body.user.name).toBe('Ramesh P');
    } finally {
      await pool.query(`UPDATE owner SET name = 'Ramesh Patil' WHERE phone = $1`, [SEED.owner1.phone]);
    }
  });
});

describe('POST /api/auth/logout', () => {
  it('returns ok with a valid token', async () => {
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${await tokenFor('manager1')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('requires a token', async () => {
    expectError(await request(app).post('/api/auth/logout'), 401, 'UNAUTHORIZED');
  });
});

describe('error shape', () => {
  it('unknown route -> 404 NOT_FOUND in contract shape', async () => {
    expectError(await request(app).get('/api/nope'), 404, 'NOT_FOUND');
  });
});
