# Rules for this repository

Read `docs/SPEC.md`, `docs/DECISIONS.md` and `docs/TASK_BOARD.md` before any work.
`docs/SPEC.md` is the single source of truth. If an idea conflicts with it, do not build it: raise it in `docs/CHANGES.md` as a Change Request.

## Locked rules

1. Simplicity first. Icons over text, one level per screen, minimal fields.
2. Only the Manager does tenant and payment data entry. The Owner is view-only plus notifications, except: the Owner sets the season password and unlocks a locked manager. The Admin (our team) only onboards owners and sets up building structure.
3. Hierarchy: Owner > Building > Floor > Room > Bed > Tenant. Icon drill-down, one level per screen.
4. Check-in, check-out, payment completion and bed shift require the manager's season password. 3 wrong tries lock the manager until the Owner unlocks.
5. Rent is due on the 5th of every month for every tenant. The first month's amount is entered manually at check-in.
6. One PAYMENT row per tenant per month. Months never merge, shortfalls never carry over. Partial payments overwrite amount_paid and payment_date on that month's row.
7. TRANSACTION_LOG is append-only. Daily and monthly collection totals come from it, grouped by transaction date (Asia/Kolkata).
8. Pending/partial tab is grouped by rent-month and shows the tenant phone as a tap-to-call link.
9. Checkout archives the tenant (soft delete). Archived tenants never appear in the live bed view, only in Past Tenants search.
10. Aadhaar: store last 4 digits only. Never store the full number.
11. No payment gateway. No ID-photo upload. No maintenance status. No per-bed history table.
12. Mobile only: one React Native (Expo) Android app for all roles. No web/desktop UI.
13. Multi-owner: every query is scoped by owner (and by building for managers). One owner must never see another owner's data.
14. Do not add tables, fields, screens or libraries not in the spec without an approved Change Request.

## Code standards

- snake_case DB fields exactly as in the spec.
- Money is whole rupees stored as integers. Never floats.
- All money and permission logic runs on the backend. Never trust the client for amounts, roles or building scope.
- Every endpoint checks role (manager/owner) and building scope.
- Validate every input.
- Every task ships with tests. No PR without passing tests.
- Dates and "today" are computed in Asia/Kolkata.
