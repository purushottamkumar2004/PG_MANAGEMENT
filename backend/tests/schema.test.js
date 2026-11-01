import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/index.js';
import { owner, manager, room, tenant, payment, transactionLog } from '../src/db/schema.js';
import { truncateAll, makeBuilding, makeTenant, expectDbError, nextPhone } from './helpers.js';

beforeEach(truncateAll);
afterAll(() => pool.end());

describe('tables', () => {
  it('has exactly the 10 spec tables', async () => {
    const { rows } = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`);
    expect(rows.map((r) => r.table_name)).toEqual([
      'admin', 'bed', 'building', 'floor', 'manager', 'owner', 'payment', 'room', 'tenant', 'transaction_log',
    ]);
  });

  it('auto-creates beds A/B/C to match room capacity', async () => {
    const ctx = await makeBuilding();
    expect(ctx.beds.map((b) => `${b.room_number}${b.bed_label}`)).toEqual(['101A', '101B', '101C', '102A', '102B']);
  });
});

describe('rooms, beds, people', () => {
  it('room capacity must be 2 or 3', async () => {
    const ctx = await makeBuilding();
    await expectDbError(db.update(room).set({ bed_capacity: 4 }).where(eq(room.id, ctx.beds[0].room_id)), 'room_bed_capacity_2_or_3');
  });

  it('phone numbers must be 10-digit Indian mobiles', async () => {
    await expectDbError(db.insert(owner).values({ name: 'O', phone: '12345', password_hash: 'x' }), 'owner_phone_format');
    await expectDbError(db.insert(owner).values({ name: 'O', phone: '+919876543210', password_hash: 'x' }), 'owner_phone_format');
  });

  it('only the last 4 Aadhaar digits can be stored', async () => {
    const ctx = await makeBuilding();
    await expectDbError(makeTenant(ctx, ctx.beds[0], { aadhaar_last4: '12a4' }), 'tenant_aadhaar_last4_digits');
    await expectDbError(makeTenant(ctx, ctx.beds[0], { aadhaar_last4: '123456789012' }), 'value too long');
  });

  it('season password lock counter stays between 0 and 3', async () => {
    const ctx = await makeBuilding();
    await expectDbError(db.update(manager).set({ failed_attempts: 4 }).where(eq(manager.id, ctx.manager.id)), 'manager_failed_attempts_range');
  });

  it('allows one manager per building', async () => {
    const ctx = await makeBuilding();
    await expectDbError(db.insert(manager).values({
      owner_id: ctx.owner.id, building_id: ctx.building.id, name: 'M2', phone: nextPhone(), password_hash: 'x',
    }), 'manager_building_id_unique');
  });
});

describe('one active tenant per bed', () => {
  it('rejects a second active tenant on the same bed', async () => {
    const ctx = await makeBuilding();
    await makeTenant(ctx, ctx.beds[0]);
    await expectDbError(makeTenant(ctx, ctx.beds[0]), 'one_active_tenant_per_bed');
  });

  it('frees the bed once the tenant is archived', async () => {
    const ctx = await makeBuilding();
    const t = await makeTenant(ctx, ctx.beds[0]);
    await db.update(tenant).set({ record_status: 'archived', bed_id: null, checkout_date: '2026-11-30' }).where(eq(tenant.id, t.id));
    await expect(makeTenant(ctx, ctx.beds[0])).resolves.toBeDefined();
  });

  it('archived tenants have no bed and a checkout date; active ones have a bed', async () => {
    const ctx = await makeBuilding();
    const t = await makeTenant(ctx, ctx.beds[0]);
    await expectDbError(db.update(tenant).set({ record_status: 'archived' }).where(eq(tenant.id, t.id)), 'tenant_status_bed_consistency');
    await expectDbError(makeTenant(ctx, { id: null }), 'tenant_status_bed_consistency');
  });
});

describe('payment rows', () => {
  let ctx, t;
  beforeEach(async () => { ctx = await makeBuilding(); t = await makeTenant(ctx, ctx.beds[0]); });
  const row = (v) => db.insert(payment).values({ tenant_id: t.id, month: '2026-11', amount_due: 7000, ...v });

  it('one row per tenant per month', async () => {
    await row({});
    await expectDbError(row({}), 'payment_tenant_month_uq');
  });

  it('month must be YYYY-MM', async () => {
    await expectDbError(row({ month: '2026-13' }), 'payment_month_format');
    await expectDbError(row({ month: 'Nov 2026' }), 'payment_month_format');
  });

  it('status must match the amounts', async () => {
    await expectDbError(row({ amount_paid: 3000, payment_status: 'pending', payment_date: '2026-11-03' }), 'payment_status_matches_amounts');
    await expectDbError(row({ amount_paid: 7000, payment_status: 'partial', payment_date: '2026-11-03' }), 'payment_status_matches_amounts');
    await expect(row({ amount_paid: 3000, payment_status: 'partial', payment_date: '2026-11-03' })).resolves.toBeDefined();
  });

  it('rejects overpayment and zero rent due', async () => {
    await expectDbError(row({ amount_paid: 8000, payment_status: 'paid', payment_date: '2026-11-03' }), 'payment_amounts_valid');
    await expectDbError(row({ amount_due: 0 }), 'payment_amounts_valid');
  });

  it('payment_date is set exactly when something is paid', async () => {
    await expectDbError(row({ payment_date: '2026-11-03' }), 'payment_date_when_paid');
    await expectDbError(row({ amount_paid: 3000, payment_status: 'partial' }), 'payment_date_when_paid');
  });
});

describe('transaction_log', () => {
  let ctx, t;
  beforeEach(async () => { ctx = await makeBuilding(); t = await makeTenant(ctx, ctx.beds[0]); });
  const log = (v) => db.insert(transactionLog).values({
    tenant_id: t.id, manager_id: ctx.manager.id, building_id: ctx.building.id, ...v,
  }).returning();

  it('is append-only: UPDATE and DELETE are blocked', async () => {
    const [l] = await log({ action_type: 'deposit', amount: 7000, payment_mode: 'cash' });
    await expectDbError(db.update(transactionLog).set({ amount: 1 }).where(eq(transactionLog.id, l.id)), 'append-only');
    await expectDbError(db.delete(transactionLog).where(eq(transactionLog.id, l.id)), 'append-only');
  });

  it('money actions need cash/upi; other actions must not have a mode', async () => {
    await expectDbError(log({ action_type: 'deposit', amount: 7000 }), 'log_mode_for_money_actions');
    await expectDbError(log({ action_type: 'check_in', payment_mode: 'cash' }), 'log_mode_for_money_actions');
  });

  it('payment entries must link a payment row and rent month', async () => {
    await expectDbError(log({ action_type: 'payment', amount: 3000, payment_mode: 'upi' }), 'log_payment_links_month');
  });
});

describe('multi-owner scope guards', () => {
  it('manager owner must match the building owner', async () => {
    const a = await makeBuilding();
    const b = await makeBuilding();
    await expectDbError(db.update(manager).set({ owner_id: b.owner.id }).where(eq(manager.id, a.manager.id)), 'manager.owner_id must match');
  });

  it('tenant bed must be inside the tenant building', async () => {
    const a = await makeBuilding();
    const b = await makeBuilding();
    await expectDbError(makeTenant(a, b.beds[0]), 'tenant.bed_id must belong');
  });

  it('log tenant and manager must belong to the log building', async () => {
    const a = await makeBuilding();
    const b = await makeBuilding();
    const t = await makeTenant(a, a.beds[0]);
    await expectDbError(db.insert(transactionLog).values({
      tenant_id: t.id, manager_id: b.manager.id, building_id: a.building.id, action_type: 'check_in',
    }), 'must belong to its building');
  });
});
