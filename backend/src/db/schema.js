// Database schema — source: docs/SPEC.md section 2.
// Money is integer rupees. Business dates use Asia/Kolkata.
import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, integer, boolean, date, timestamp, char,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';

export const recordStatus = pgEnum('record_status', ['active', 'archived']);
export const paymentStatus = pgEnum('payment_status', ['pending', 'partial', 'paid']);
export const actionType = pgEnum('action_type', [
  'check_in', 'payment', 'deposit', 'check_out', 'deposit_refund', 'bed_shift',
]);
export const paymentMode = pgEnum('payment_mode', ['cash', 'upi']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
// Indian mobile number, 10 digits, stored without +91
const phoneCheck = (name, col) => check(name, sql`${col} ~ '^[6-9][0-9]{9}$'`);
const MONTH_RE = sql.raw(`'^[0-9]{4}-(0[1-9]|1[0-2])$'`);

export const admin = pgTable('admin', {
  id: id(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: createdAt(),
}, (t) => [phoneCheck('admin_phone_format', t.phone)]);

export const owner = pgTable('owner', {
  id: id(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: createdAt(),
}, (t) => [phoneCheck('owner_phone_format', t.phone)]);

export const building = pgTable('building', {
  id: id(),
  owner_id: uuid('owner_id').notNull().references(() => owner.id),
  name: text('name').notNull(),
  address: text('address'),
  photo_url: text('photo_url'),
  created_at: createdAt(),
}, (t) => [index('building_owner_idx').on(t.owner_id)]);

export const manager = pgTable('manager', {
  id: id(),
  owner_id: uuid('owner_id').notNull().references(() => owner.id),
  building_id: uuid('building_id').notNull().unique().references(() => building.id),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  current_code_hash: text('current_code_hash'),
  code_updated_at: timestamp('code_updated_at', { withTimezone: true }),
  failed_attempts: integer('failed_attempts').notNull().default(0),
  is_locked: boolean('is_locked').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  created_at: createdAt(),
}, (t) => [
  phoneCheck('manager_phone_format', t.phone),
  check('manager_failed_attempts_range', sql`${t.failed_attempts} BETWEEN 0 AND 3`),
]);

export const floor = pgTable('floor', {
  id: id(),
  building_id: uuid('building_id').notNull().references(() => building.id),
  floor_number: integer('floor_number').notNull(),
}, (t) => [
  uniqueIndex('floor_building_number_uq').on(t.building_id, t.floor_number),
  check('floor_number_range', sql`${t.floor_number} BETWEEN 0 AND 200`),
]);

export const room = pgTable('room', {
  id: id(),
  floor_id: uuid('floor_id').notNull().references(() => floor.id),
  room_number: text('room_number').notNull(),
  bed_capacity: integer('bed_capacity').notNull(),
}, (t) => [
  uniqueIndex('room_floor_number_uq').on(t.floor_id, t.room_number),
  check('room_bed_capacity_2_or_3', sql`${t.bed_capacity} IN (2, 3)`),
]);

export const bed = pgTable('bed', {
  id: id(),
  room_id: uuid('room_id').notNull().references(() => room.id),
  bed_label: text('bed_label').notNull(),
}, (t) => [
  uniqueIndex('bed_room_label_uq').on(t.room_id, t.bed_label),
  check('bed_label_abc', sql`${t.bed_label} IN ('A', 'B', 'C')`),
]);

export const tenant = pgTable('tenant', {
  id: id(),
  building_id: uuid('building_id').notNull().references(() => building.id),
  bed_id: uuid('bed_id').references(() => bed.id),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  age: integer('age'),
  aadhaar_last4: char('aadhaar_last4', { length: 4 }),
  monthly_rent: integer('monthly_rent').notNull(),
  deposit: integer('deposit').notNull().default(0),
  start_date: date('start_date').notNull(),
  record_status: recordStatus('record_status').notNull().default('active'),
  checkout_date: date('checkout_date'),
  deposit_returned: integer('deposit_returned'),
  deposit_deduction: integer('deposit_deduction'),
  created_by_manager_id: uuid('created_by_manager_id').notNull().references(() => manager.id),
  created_at: createdAt(),
}, (t) => [
  // Rule: at most one active tenant per bed
  uniqueIndex('one_active_tenant_per_bed').on(t.bed_id).where(sql`${t.record_status} = 'active'`),
  index('tenant_building_status_idx').on(t.building_id, t.record_status),
  phoneCheck('tenant_phone_format', t.phone),
  check('tenant_age_range', sql`${t.age} IS NULL OR ${t.age} BETWEEN 14 AND 100`),
  check('tenant_aadhaar_last4_digits', sql`${t.aadhaar_last4} IS NULL OR ${t.aadhaar_last4} ~ '^[0-9]{4}$'`),
  check('tenant_money_non_negative', sql`${t.monthly_rent} > 0 AND ${t.deposit} >= 0
    AND COALESCE(${t.deposit_returned}, 0) >= 0 AND COALESCE(${t.deposit_deduction}, 0) >= 0`),
  // Active tenant sits on a bed; archived tenant has no bed and has a checkout date
  check('tenant_status_bed_consistency', sql`
    (${t.record_status} = 'active' AND ${t.bed_id} IS NOT NULL AND ${t.checkout_date} IS NULL)
    OR (${t.record_status} = 'archived' AND ${t.bed_id} IS NULL AND ${t.checkout_date} IS NOT NULL)`),
]);

export const payment = pgTable('payment', {
  id: id(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenant.id),
  month: text('month').notNull(), // YYYY-MM
  amount_due: integer('amount_due').notNull(),
  amount_paid: integer('amount_paid').notNull().default(0),
  payment_status: paymentStatus('payment_status').notNull().default('pending'),
  payment_date: date('payment_date'),
}, (t) => [
  // Rule: one payment row per tenant per month
  uniqueIndex('payment_tenant_month_uq').on(t.tenant_id, t.month),
  index('payment_month_status_idx').on(t.month, t.payment_status),
  check('payment_month_format', sql`${t.month} ~ ${MONTH_RE}`),
  check('payment_amounts_valid', sql`${t.amount_due} > 0 AND ${t.amount_paid} >= 0 AND ${t.amount_paid} <= ${t.amount_due}`),
  // Status must always match the amounts
  check('payment_status_matches_amounts', sql`
    (${t.payment_status} = 'pending' AND ${t.amount_paid} = 0)
    OR (${t.payment_status} = 'partial' AND ${t.amount_paid} > 0 AND ${t.amount_paid} < ${t.amount_due})
    OR (${t.payment_status} = 'paid' AND ${t.amount_paid} = ${t.amount_due})`),
  check('payment_date_when_paid', sql`(${t.amount_paid} = 0) = (${t.payment_date} IS NULL)`),
]);

// Append-only. UPDATE and DELETE are blocked by a trigger (see custom migration).
export const transactionLog = pgTable('transaction_log', {
  id: id(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenant.id),
  manager_id: uuid('manager_id').notNull().references(() => manager.id),
  building_id: uuid('building_id').notNull().references(() => building.id),
  payment_id: uuid('payment_id').references(() => payment.id),
  action_type: actionType('action_type').notNull(),
  amount: integer('amount').notNull().default(0),
  payment_mode: paymentMode('payment_mode'),
  rent_month: text('rent_month'),
  note: text('note'),
  created_at: createdAt(),
}, (t) => [
  index('log_building_created_idx').on(t.building_id, t.created_at),
  check('log_amount_non_negative', sql`${t.amount} >= 0`),
  // Money actions need a payment mode; others must not have one
  check('log_mode_for_money_actions', sql`
    (${t.action_type} IN ('payment', 'deposit', 'deposit_refund')) = (${t.payment_mode} IS NOT NULL)`),
  check('log_payment_links_month', sql`
    ${t.action_type} <> 'payment' OR (${t.payment_id} IS NOT NULL AND ${t.rent_month} IS NOT NULL AND ${t.amount} > 0)`),
  check('log_rent_month_format', sql`${t.rent_month} IS NULL OR ${t.rent_month} ~ ${MONTH_RE}`),
]);
