// Sample data for development and testing. Never run in production.
// Logins (phone / password):
//   Admin    9000000000 / admin123
//   Owner 1  9000000001 / owner123   (2 buildings)
//   Manager  9000000002 / manager123 (Shanti PG)   season code 993560
//   Manager  9000000003 / manager123 (Sai Residency) season code 993560
//   Owner 2  9000000004 / owner123   (1 building, used for isolation tests)
//   Manager  9000000005 / manager123 (Green Nest PG) season code 112233
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { db, pool } from './index.js';
import { admin, owner, manager, tenant, payment, transactionLog } from './schema.js';
import { createBuildingStructure } from './structure.js';
import { todayIST, currentMonthIST, addMonths } from '../lib/dates.js';

const hash = (s) => bcrypt.hashSync(s, 10);

export async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');
  const existing = await db.select({ id: owner.id }).from(owner).limit(1);
  if (existing.length) throw new Error('Database is not empty. Run `npm run db:reset` for a fresh seed.');

  const thisMonth = currentMonthIST();
  const lastMonth = addMonths(thisMonth, -1);
  const today = todayIST();
  const lastMonthDate = `${lastMonth}-06`;

  return db.transaction(async (tx) => {
    await tx.insert(admin).values({ name: 'Platform Admin', phone: '9000000000', password_hash: hash('admin123') });

    const [o1] = await tx.insert(owner).values({ name: 'Ramesh Patil', phone: '9000000001', password_hash: hash('owner123') }).returning();
    const [o2] = await tx.insert(owner).values({ name: 'Meena Shah', phone: '9000000004', password_hash: hash('owner123') }).returning();

    const shanti = await createBuildingStructure(tx, {
      owner_id: o1.id, name: 'Shanti PG', address: 'Kothrud, Pune',
      floors: [
        { number: 1, rooms: [{ number: '101', capacity: 3 }, { number: '102', capacity: 2 }] },
        { number: 2, rooms: [{ number: '201', capacity: 3 }, { number: '202', capacity: 2 }] },
      ],
    });
    const sai = await createBuildingStructure(tx, {
      owner_id: o1.id, name: 'Sai Residency', address: 'Hinjewadi, Pune',
      floors: [{ number: 1, rooms: [{ number: '101', capacity: 3 }, { number: '102', capacity: 3 }] }],
    });
    const green = await createBuildingStructure(tx, {
      owner_id: o2.id, name: 'Green Nest PG', address: 'Baner, Pune',
      floors: [{ number: 1, rooms: [{ number: '101', capacity: 2 }] }],
    });

    const mkManager = async (o, b, name, phone, code) => {
      const [m] = await tx.insert(manager).values({
        owner_id: o.id, building_id: b.building.id, name, phone,
        password_hash: hash('manager123'), current_code_hash: hash(code), code_updated_at: new Date(),
      }).returning();
      return m;
    };
    const m1 = await mkManager(o1, shanti, 'Suresh', '9000000002', '993560');
    const m2 = await mkManager(o1, sai, 'Anil', '9000000003', '993560');
    const m3 = await mkManager(o2, green, 'Kiran', '9000000005', '112233');

    // Adds a tenant on a bed with a check-in + deposit log entry.
    const addTenant = async (b, m, bedRow, t) => {
      const [row] = await tx.insert(tenant).values({
        building_id: b.building.id, bed_id: bedRow.id, created_by_manager_id: m.id,
        name: t.name, phone: t.phone, age: t.age, aadhaar_last4: t.aadhaar_last4,
        monthly_rent: t.rent, deposit: t.deposit, start_date: t.start,
      }).returning();
      await tx.insert(transactionLog).values({ tenant_id: row.id, manager_id: m.id, building_id: b.building.id, action_type: 'check_in' });
      if (t.deposit > 0) {
        await tx.insert(transactionLog).values({
          tenant_id: row.id, manager_id: m.id, building_id: b.building.id,
          action_type: 'deposit', amount: t.deposit, payment_mode: 'cash',
        });
      }
      return row;
    };

    // Creates the month row, and a payment log entry if anything was paid.
    const addMonth = async (b, m, t, month, due, paid, mode, date) => {
      const status = paid === 0 ? 'pending' : paid < due ? 'partial' : 'paid';
      const [p] = await tx.insert(payment).values({
        tenant_id: t.id, month, amount_due: due, amount_paid: paid,
        payment_status: status, payment_date: paid > 0 ? date : null,
      }).returning();
      if (paid > 0) {
        await tx.insert(transactionLog).values({
          tenant_id: t.id, manager_id: m.id, building_id: b.building.id, payment_id: p.id,
          action_type: 'payment', amount: paid, payment_mode: mode, rent_month: month,
        });
      }
      return p;
    };

    const start = `${lastMonth}-01`;
    // Shanti PG: paid, partial, pending, paid; one past tenant
    const t1 = await addTenant(shanti, m1, shanti.beds[0], { name: 'Amit Kumar', phone: '9876500001', age: 22, aadhaar_last4: '1234', rent: 8000, deposit: 8000, start });
    const t2 = await addTenant(shanti, m1, shanti.beds[1], { name: 'Rahul Verma', phone: '9876500002', age: 24, aadhaar_last4: '5678', rent: 7000, deposit: 7000, start });
    const t3 = await addTenant(shanti, m1, shanti.beds[3], { name: 'Vikas Singh', phone: '9876500003', age: 21, aadhaar_last4: null, rent: 7500, deposit: 5000, start });
    const t4 = await addTenant(shanti, m1, shanti.beds[5], { name: 'Nitin Joshi', phone: '9876500004', age: 26, aadhaar_last4: '4321', rent: 6500, deposit: 6500, start });
    for (const [t, rent] of [[t1, 8000], [t2, 7000], [t4, 6500]]) await addMonth(shanti, m1, t, lastMonth, rent, rent, 'cash', lastMonthDate);
    await addMonth(shanti, m1, t3, lastMonth, 7500, 4000, 'upi', lastMonthDate); // last month still partial
    await addMonth(shanti, m1, t1, thisMonth, 8000, 8000, 'cash', today);
    await addMonth(shanti, m1, t2, thisMonth, 7000, 3000, 'upi', today);
    await addMonth(shanti, m1, t3, thisMonth, 7500, 0, null, today);
    await addMonth(shanti, m1, t4, thisMonth, 6500, 6500, 'upi', today);

    const [past] = await tx.insert(tenant).values({
      building_id: shanti.building.id, bed_id: null, created_by_manager_id: m1.id,
      name: 'Old Tenant Deepak', phone: '9876500009', age: 30, monthly_rent: 7000, deposit: 7000,
      start_date: `${addMonths(thisMonth, -6)}-01`, record_status: 'archived',
      checkout_date: `${lastMonth}-28`, deposit_returned: 6000, deposit_deduction: 1000,
    }).returning();
    await tx.insert(transactionLog).values({ tenant_id: past.id, manager_id: m1.id, building_id: shanti.building.id, action_type: 'check_out' });
    await tx.insert(transactionLog).values({
      tenant_id: past.id, manager_id: m1.id, building_id: shanti.building.id,
      action_type: 'deposit_refund', amount: 6000, payment_mode: 'cash',
    });

    // Sai Residency: one paid, one pending
    const t5 = await addTenant(sai, m2, sai.beds[0], { name: 'Sanjay Rao', phone: '9876500005', age: 23, aadhaar_last4: '1111', rent: 9000, deposit: 9000, start: `${thisMonth}-01` });
    const t6 = await addTenant(sai, m2, sai.beds[3], { name: 'Kunal Mehta', phone: '9876500006', age: 25, aadhaar_last4: '2222', rent: 9000, deposit: 9000, start: `${thisMonth}-01` });
    await addMonth(sai, m2, t5, thisMonth, 9000, 9000, 'cash', today);
    await addMonth(sai, m2, t6, thisMonth, 9000, 0, null, today);

    // Owner 2: one pending tenant
    const t7 = await addTenant(green, m3, green.beds[0], { name: 'Priya Nair', phone: '9876500007', age: 27, aadhaar_last4: '3333', rent: 6000, deposit: 6000, start: `${thisMonth}-01` });
    await addMonth(green, m3, t7, thisMonth, 6000, 0, null, today);

    return { owners: [o1, o2], managers: [m1, m2, m3], buildings: [shanti, sai, green] };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seed();
  console.log('Seed data inserted. Logins are listed at the top of src/db/seed.js');
  await pool.end();
}
