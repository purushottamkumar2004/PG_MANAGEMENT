import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { truncateAll } from './helpers.js';
import { currentMonthIST } from '../src/lib/dates.js';

beforeAll(async () => { await truncateAll(); await seed(); });
afterAll(() => pool.end());

const one = async (q, p) => (await pool.query(q, p)).rows[0];

describe('seed data', () => {
  it('creates admin, 2 owners, 3 buildings, 3 managers, 18 beds', async () => {
    const c = await one(`SELECT (SELECT count(*) FROM admin)::int a, (SELECT count(*) FROM owner)::int o,
      (SELECT count(*) FROM building)::int b, (SELECT count(*) FROM manager)::int m, (SELECT count(*) FROM bed)::int beds`);
    expect(c).toEqual({ a: 1, o: 2, b: 3, m: 3, beds: 18 });
  });

  it('has paid, partial and pending rows for the current month', async () => {
    const { rows } = await pool.query(
      `SELECT payment_status s, count(*)::int n FROM payment WHERE month = $1 GROUP BY 1 ORDER BY 1`, [currentMonthIST()]);
    expect(rows).toEqual([{ s: 'pending', n: 3 }, { s: 'partial', n: 1 }, { s: 'paid', n: 3 }]);
  });

  it('keeps one archived tenant out of the beds', async () => {
    const c = await one(`SELECT count(*)::int n FROM tenant WHERE record_status = 'archived' AND bed_id IS NULL`);
    expect(c.n).toBe(1);
  });

  it('log payment totals equal amounts paid on payment rows', async () => {
    const c = await one(`SELECT (SELECT sum(amount) FROM transaction_log WHERE action_type = 'payment')::int logged,
      (SELECT sum(amount_paid) FROM payment)::int paid`);
    expect(c.logged).toBe(c.paid);
  });

  it('refuses to seed a database that already has data', async () => {
    await expect(seed()).rejects.toThrow('not empty');
  });
});
