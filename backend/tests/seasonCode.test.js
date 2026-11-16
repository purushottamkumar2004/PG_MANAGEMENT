// T-06: season password — owner sets/unlocks, verify helper, 3-try lock, manager status.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { verifySeasonCode, isAcceptableNewCode } from '../src/lib/seasonCode.js';
import { AppError } from '../src/lib/errors.js';
import { truncateAll } from './helpers.js';

const SEED = {
  admin: { phone: '9000000000', password: 'admin123' },
  owner1: { phone: '9000000001', password: 'owner123' },
  manager1: { phone: '9000000002', password: 'manager123' }, // Shanti PG, owner 1, code 993560
  manager2: { phone: '9000000003', password: 'manager123' }, // Sai Residency, owner 1
  owner2: { phone: '9000000004', password: 'owner123' },
  manager3: { phone: '9000000005', password: 'manager123' }, // Green Nest PG, owner 2
};
const CODE = '993560';
const ORIGINAL_HASH = bcrypt.hashSync(CODE, 10);

const tokens = {};
const ids = {};
const one = async (q, p) => (await pool.query(q, p)).rows[0];
const managerRow = (id) => one('SELECT failed_attempts, is_locked, current_code_hash, code_updated_at FROM manager WHERE id = $1', [id]);
const auth = (req, who) => req.set('Authorization', `Bearer ${tokens[who]}`);
const api = {
  list: (who) => auth(request(app).get('/api/owner/managers'), who),
  setCode: (who, id, body) => auth(request(app).put(`/api/owner/managers/${id}/season-code`), who).send(body),
  unlock: (who, id) => auth(request(app).post(`/api/owner/managers/${id}/unlock`), who),
  status: (who) => auth(request(app).get('/api/manager/status'), who),
};
const expectError = (res, status, code, extra = {}) => {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: { code, message: expect.any(String), ...extra } });
};
const expectNoSecrets = (res) => {
  const text = JSON.stringify(res.body);
  expect(text).not.toMatch(/password_hash|current_code_hash|code_hash|\$2[aby]\$/);
};
/** Runs the helper and returns the AppError it threw (or null on success). */
const tryVerify = async (id, code) => {
  try {
    await verifySeasonCode(id, code);
    return null;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e;
  }
};
const lockState = (id, failed, locked) => pool.query(
  'UPDATE manager SET failed_attempts = $2, is_locked = $3 WHERE id = $1', [id, failed, locked],
);

beforeAll(async () => {
  await truncateAll();
  await seed();
  for (const who of Object.keys(SEED)) {
    const res = await request(app).post('/api/auth/login').send(SEED[who]);
    tokens[who] = res.body.token;
    ids[who] = res.body.user.id;
  }
});

// Every test starts with all managers holding the seed code, unlocked, 0 attempts.
beforeEach(async () => {
  await pool.query(
    'UPDATE manager SET current_code_hash = $1, failed_attempts = 0, is_locked = false',
    [ORIGINAL_HASH],
  );
});

afterAll(() => pool.end());

describe('code rules', () => {
  it('accepts normal 6-digit codes and rejects weak ones', () => {
    for (const ok of ['993560', '112233', '000001', '123457']) expect(isAcceptableNewCode(ok)).toBe(true);
    for (const bad of ['111111', '000000', '999999', '123456', '654321', '12345', '1234567', '12a456', '', ' 993560', 993560, null, undefined]) {
      expect(isAcceptableNewCode(bad)).toBe(false);
    }
  });
});

describe('GET /api/owner/managers', () => {
  it('lists only the owner\'s own managers, sorted by building name, without hashes', async () => {
    const res = await api.list('owner1');
    expect(res.status).toBe(200);
    expectNoSecrets(res);
    expect(res.body.managers.map((m) => m.building_name)).toEqual(['Sai Residency', 'Shanti PG']);
    const shanti = res.body.managers.find((m) => m.id === ids.manager1);
    expect(shanti).toEqual({
      id: ids.manager1, name: expect.any(String), phone: SEED.manager1.phone,
      building_id: expect.any(String), building_name: 'Shanti PG', is_active: true,
      has_season_code: true, code_updated_at: expect.any(String), is_locked: false, failed_attempts: 0,
    });
    expect(Object.keys(shanti).sort()).toEqual([
      'building_id', 'building_name', 'code_updated_at', 'failed_attempts', 'has_season_code',
      'id', 'is_active', 'is_locked', 'name', 'phone',
    ]);
    expect(res.body.managers.some((m) => m.id === ids.manager3)).toBe(false);
  });

  it('owner 2 sees only their manager', async () => {
    const res = await api.list('owner2');
    expect(res.status).toBe(200);
    expect(res.body.managers.map((m) => m.id)).toEqual([ids.manager3]);
  });

  it('shows has_season_code false and null date when no code is set', async () => {
    await pool.query('UPDATE manager SET current_code_hash = NULL, code_updated_at = NULL WHERE id = $1', [ids.manager2]);
    const res = await api.list('owner1');
    const sai = res.body.managers.find((m) => m.id === ids.manager2);
    expect(sai.has_season_code).toBe(false);
    expect(sai.code_updated_at).toBeNull();
  });
});

describe('PUT /api/owner/managers/:id/season-code', () => {
  it('sets a code: new hash, new date, verify works with it and not with the old one', async () => {
    const before = await managerRow(ids.manager1);
    const res = await api.setCode('owner1', ids.manager1, { code: '482913' });
    expect(res.status).toBe(200);
    expectNoSecrets(res);
    expect(res.body.manager).toMatchObject({ id: ids.manager1, has_season_code: true, is_locked: false, failed_attempts: 0 });

    const after = await managerRow(ids.manager1);
    expect(after.current_code_hash).not.toBe(before.current_code_hash);
    expect(after.current_code_hash).not.toContain('482913');
    expect(await bcrypt.compare('482913', after.current_code_hash)).toBe(true);
    expect(new Date(res.body.manager.code_updated_at).getTime()).toBe(after.code_updated_at.getTime());
    expect(Date.now() - after.code_updated_at.getTime()).toBeLessThan(60_000);

    expect(await tryVerify(ids.manager1, '482913')).toBeNull();
    const wrong = await tryVerify(ids.manager1, CODE);
    expect(wrong.code).toBe('SEASON_CODE_WRONG');
  });

  it('changes an existing code and sets a first code for a manager who had none', async () => {
    await pool.query('UPDATE manager SET current_code_hash = NULL, code_updated_at = NULL WHERE id = $1', [ids.manager2]);
    const first = await api.setCode('owner1', ids.manager2, { code: '271828' });
    expect(first.status).toBe(200);
    expect(first.body.manager.has_season_code).toBe(true);
    const second = await api.setCode('owner1', ids.manager2, { code: '314159' });
    expect(second.status).toBe(200);
    expect(await tryVerify(ids.manager2, '314159')).toBeNull();
    expect((await tryVerify(ids.manager2, '271828')).code).toBe('SEASON_CODE_WRONG');
  });

  it('new code resets the lock and the attempts', async () => {
    await lockState(ids.manager1, 3, true);
    const res = await api.setCode('owner1', ids.manager1, { code: '482913' });
    expect(res.status).toBe(200);
    expect(res.body.manager).toMatchObject({ is_locked: false, failed_attempts: 0 });
    expect(await managerRow(ids.manager1)).toMatchObject({ is_locked: false, failed_attempts: 0 });
  });

  it.each([
    ['all same digit', { code: '111111' }],
    ['all zeros', { code: '000000' }],
    ['123456', { code: '123456' }],
    ['654321', { code: '654321' }],
    ['5 digits', { code: '12345' }],
    ['7 digits', { code: '1234567' }],
    ['letters', { code: '12ab56' }],
    ['number instead of string', { code: 482913 }],
    ['missing', {}],
  ])('rejects %s with 400 and keeps the old code', async (_label, body) => {
    const before = await managerRow(ids.manager1);
    const res = await api.setCode('owner1', ids.manager1, body);
    expectError(res, 400, 'VALIDATION_ERROR');
    expect((await managerRow(ids.manager1)).current_code_hash).toBe(before.current_code_hash);
  });

  it('another owner\'s manager, unknown and malformed ids → 404', async () => {
    const before = await managerRow(ids.manager3);
    expectError(await api.setCode('owner1', ids.manager3, { code: '482913' }), 404, 'NOT_FOUND');
    expectError(await api.setCode('owner1', '00000000-0000-4000-8000-000000000000', { code: '482913' }), 404, 'NOT_FOUND');
    expectError(await api.setCode('owner1', 'not-a-uuid', { code: '482913' }), 404, 'NOT_FOUND');
    expect((await managerRow(ids.manager3)).current_code_hash).toBe(before.current_code_hash);
  });
});

describe('POST /api/owner/managers/:id/unlock', () => {
  it('resets attempts and lock, keeps the code', async () => {
    await lockState(ids.manager1, 3, true);
    const before = await managerRow(ids.manager1);
    const res = await api.unlock('owner1', ids.manager1);
    expect(res.status).toBe(200);
    expectNoSecrets(res);
    expect(res.body.manager).toMatchObject({ id: ids.manager1, is_locked: false, failed_attempts: 0, has_season_code: true });
    const after = await managerRow(ids.manager1);
    expect(after.current_code_hash).toBe(before.current_code_hash);
    expect(after.code_updated_at.getTime()).toBe(before.code_updated_at.getTime());
    expect(await tryVerify(ids.manager1, CODE)).toBeNull();
  });

  it('another owner\'s manager → 404 and stays locked', async () => {
    await lockState(ids.manager3, 3, true);
    expectError(await api.unlock('owner1', ids.manager3), 404, 'NOT_FOUND');
    expect((await managerRow(ids.manager3)).is_locked).toBe(true);
  });
});

describe('roles on owner and manager endpoints', () => {
  it('manager and admin get 403 on every owner endpoint (admin cannot set codes)', async () => {
    for (const who of ['manager1', 'admin']) {
      expectError(await api.list(who), 403, 'FORBIDDEN');
      expectError(await api.setCode(who, ids.manager1, { code: '482913' }), 403, 'FORBIDDEN');
      expectError(await api.unlock(who, ids.manager1), 403, 'FORBIDDEN');
    }
    expect(await bcrypt.compare(CODE, (await managerRow(ids.manager1)).current_code_hash)).toBe(true);
  });

  it('owner and admin get 403 on /api/manager/status', async () => {
    expectError(await api.status('owner1'), 403, 'FORBIDDEN');
    expectError(await api.status('admin'), 403, 'FORBIDDEN');
  });

  it('no token → 401', async () => {
    expectError(await request(app).get('/api/owner/managers'), 401, 'UNAUTHORIZED');
    expectError(await request(app).get('/api/manager/status'), 401, 'UNAUTHORIZED');
  });
});

describe('verifySeasonCode helper', () => {
  it('correct code resolves and resets failed attempts', async () => {
    await lockState(ids.manager1, 2, false);
    expect(await tryVerify(ids.manager1, CODE)).toBeNull();
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 0, is_locked: false });
  });

  it('wrong 1st and 2nd → 403 with attempts_left 2 and 1; 3rd → 423 locked with attempts_left 0', async () => {
    const e1 = await tryVerify(ids.manager1, '000001');
    expect([e1.status, e1.code, e1.extra]).toEqual([403, 'SEASON_CODE_WRONG', { attempts_left: 2 }]);
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 1, is_locked: false });

    const e2 = await tryVerify(ids.manager1, '000002');
    expect([e2.status, e2.code, e2.extra]).toEqual([403, 'SEASON_CODE_WRONG', { attempts_left: 1 }]);
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 2, is_locked: false });

    const e3 = await tryVerify(ids.manager1, '000003');
    expect([e3.status, e3.code, e3.extra]).toEqual([423, 'MANAGER_LOCKED', { attempts_left: 0 }]);
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 3, is_locked: true });
  });

  it('locked + correct code → still 423, attempts unchanged', async () => {
    await lockState(ids.manager1, 3, true);
    const e = await tryVerify(ids.manager1, CODE);
    expect([e.status, e.code]).toEqual([423, 'MANAGER_LOCKED']);
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 3, is_locked: true });
  });

  it('locked + wrong code → 423, not counted', async () => {
    await lockState(ids.manager1, 3, true);
    const e = await tryVerify(ids.manager1, '000001');
    expect(e.code).toBe('MANAGER_LOCKED');
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 3, is_locked: true });
  });

  it('no code set → 409 SEASON_CODE_NOT_SET, not counted', async () => {
    await pool.query('UPDATE manager SET current_code_hash = NULL WHERE id = $1', [ids.manager1]);
    const e = await tryVerify(ids.manager1, CODE);
    expect([e.status, e.code]).toEqual([409, 'SEASON_CODE_NOT_SET']);
    expect((await managerRow(ids.manager1)).failed_attempts).toBe(0);
  });

  it.each([undefined, null, '', '12345', '1234567', '99356a', 993560, ' 993560'])(
    'bad format %j → 400, attempts unchanged',
    async (code) => {
      await lockState(ids.manager1, 1, false);
      const e = await tryVerify(ids.manager1, code);
      expect([e.status, e.code]).toEqual([400, 'VALIDATION_ERROR']);
      expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 1, is_locked: false });
    },
  );

  it('unknown or malformed manager id → 404', async () => {
    expect((await tryVerify('00000000-0000-4000-8000-000000000000', CODE)).code).toBe('NOT_FOUND');
    expect((await tryVerify('nope', CODE)).code).toBe('NOT_FOUND');
  });

  it('wrong attempts on one manager do not affect another', async () => {
    await tryVerify(ids.manager1, '000001');
    expect((await managerRow(ids.manager2)).failed_attempts).toBe(0);
  });

  it('5 parallel wrong attempts end at exactly 3 and locked', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => tryVerify(ids.manager1, `00000${i}`)));
    const codes = results.map((e) => e.code).sort();
    expect(codes).toEqual(['MANAGER_LOCKED', 'MANAGER_LOCKED', 'MANAGER_LOCKED', 'SEASON_CODE_WRONG', 'SEASON_CODE_WRONG']);
    expect(results.filter((e) => e.extra?.attempts_left === 0)).toHaveLength(1);
    expect(await managerRow(ids.manager1)).toMatchObject({ failed_attempts: 3, is_locked: true });
  });

  it('parallel correct and wrong attempts never exceed 3 and never deadlock', async () => {
    const codes = ['000001', CODE, '000002', '000003', CODE, '000004', '000005'];
    const results = await Promise.all(codes.map((c) => tryVerify(ids.manager1, c)));
    const row = await managerRow(ids.manager1);
    expect(row.failed_attempts).toBeLessThanOrEqual(3);
    for (const e of results) if (e) expect(['SEASON_CODE_WRONG', 'MANAGER_LOCKED']).toContain(e.code);
  });
});

describe('error body carries attempts_left over HTTP', () => {
  it('serialises extra fields next to code and message', async () => {
    const { errorHandler } = await import('../src/middleware/errors.js');
    let status; let body;
    const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
    try { await verifySeasonCode(ids.manager1, '000001'); } catch (e) { errorHandler(e, {}, res, () => {}); }
    expect(status).toBe(403);
    expect(body).toEqual({ error: { code: 'SEASON_CODE_WRONG', message: 'Wrong season password', attempts_left: 2 } });
  });

  it('extra fields cannot overwrite code or message', async () => {
    const { errorHandler } = await import('../src/middleware/errors.js');
    let body;
    const res = { status() { return this; }, json(b) { body = b; return this; } };
    errorHandler(new AppError(400, 'X', 'msg', { code: 'Y', message: 'z', n: 1 }), {}, res, () => {});
    expect(body).toEqual({ error: { code: 'X', message: 'msg', n: 1 } });
  });
});

describe('GET /api/manager/status', () => {
  it('reflects every state: normal, after wrong tries, locked, unlocked, new code, no code', async () => {
    const s = async () => (await api.status('manager1')).body;
    expect(await s()).toEqual({ has_season_code: true, is_locked: false, attempts_left: 3 });

    await tryVerify(ids.manager1, '000001');
    expect(await s()).toEqual({ has_season_code: true, is_locked: false, attempts_left: 2 });
    await tryVerify(ids.manager1, '000002');
    expect(await s()).toEqual({ has_season_code: true, is_locked: false, attempts_left: 1 });
    await tryVerify(ids.manager1, '000003');
    expect(await s()).toEqual({ has_season_code: true, is_locked: true, attempts_left: 0 });

    expect((await api.unlock('owner1', ids.manager1)).status).toBe(200);
    expect(await s()).toEqual({ has_season_code: true, is_locked: false, attempts_left: 3 });

    await tryVerify(ids.manager1, '000001');
    expect(await s()).toMatchObject({ attempts_left: 2 });
    expect((await api.setCode('owner1', ids.manager1, { code: '482913' })).status).toBe(200);
    expect(await s()).toEqual({ has_season_code: true, is_locked: false, attempts_left: 3 });

    await pool.query('UPDATE manager SET current_code_hash = NULL WHERE id = $1', [ids.manager1]);
    expect(await s()).toEqual({ has_season_code: false, is_locked: false, attempts_left: 3 });
  });

  it('a locked manager can still log in and view /auth/me (D-20)', async () => {
    await lockState(ids.manager1, 3, true);
    const login = await request(app).post('/api/auth/login').send(SEED.manager1);
    expect(login.status).toBe(200);
    expect((await auth(request(app).get('/api/auth/me'), 'manager1')).status).toBe(200);
    expectNoSecrets(await api.status('manager1'));
  });
});
