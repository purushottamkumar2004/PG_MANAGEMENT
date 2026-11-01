# Backend

Node.js + Express + Drizzle ORM + PostgreSQL 16.

## First-time setup

1. Install Node 22+ and PostgreSQL 16.
2. Create two databases, one for development and one for tests:
   ```
   createdb pg_dev
   createdb pg_test
   ```
3. `cp .env.example .env` and set both URLs.
4. `npm install`
5. `npm run db:reset` — wipes pg_dev, applies migrations, loads sample data.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs all tests against `TEST_DATABASE_URL` (wipes that DB) |
| `npm run db:reset` | Fresh dev database with sample data |
| `npm run db:migrate` | Applies new migrations only |
| `npm run db:generate` | Creates a migration after editing `src/db/schema.js` |

## Sample logins (after db:reset)

| Role | Phone | Password | Season code |
|---|---|---|---|
| Admin | 9000000000 | admin123 | |
| Owner 1 | 9000000001 | owner123 | |
| Manager, Shanti PG | 9000000002 | manager123 | 993560 |
| Manager, Sai Residency | 9000000003 | manager123 | 993560 |
| Owner 2 | 9000000004 | owner123 | |
| Manager, Green Nest PG | 9000000005 | manager123 | 112233 |

## Rules the database enforces on its own

Even if API code has a bug, Postgres rejects:
- a second active tenant on the same bed
- an archived tenant still holding a bed, or an active tenant without one
- more than one payment row per tenant per month
- a payment status that doesn't match the amounts, overpayment, or zero rent due
- any UPDATE or DELETE on `transaction_log`
- money entries without cash/upi, or payment entries without a rent month
- data linking one owner's building to another owner's tenant or manager
- room capacity other than 2 or 3, bad phone numbers, more than 4 Aadhaar digits
