# T-04: Structure read APIs with occupancy and bed status

- **Worker role:** Backend
- **Branch:** `t-04-read-apis`
- **Depends on:** T-03 (merged)
- **Goal:** Owner and manager can drill down Building → Floors → Rooms → Beds → Bed detail, with free-bed counts and colour status computed on the server.

## Inputs
- `docs/API_CONTRACT.md` section "Structure read" (follow exactly, including the bed status table)
- `docs/SPEC.md` sections 2 and 4, locked rules 3, 9, 13; D-02, D-03
- Reuse: `requireAuth`, `requireRole('owner','manager')`, `assertBuildingAccess`, `src/lib/dates.js` (India time)

## Deliverables
1. `backend/src/routes/structure.js` with the 5 endpoints, mounted under `/api` in `app.js` (one line).
2. Bed status logic in one pure function `backend/src/lib/bedStatus.js`, e.g. `bedStatus({ hasTenant, paymentStatus, today })`, unit-tested on its own.
3. Every floor/room/bed id is resolved to its building, then checked with `assertBuildingAccess`. Wrong owner or building → 404.
4. Archived tenants never appear (locked rule 9): only `record_status = 'active'` counts as occupying a bed.
5. Efficient queries: counts done in SQL (GROUP BY or aggregate joins), not by loading every bed in JavaScript. One query per endpoint is the target; two is fine.
6. Tests (Vitest + Supertest) using the seed data and `vi.setSystemTime` for dates, at least:
   - building list counts match the seed (Shanti PG 10 beds/4 occupied, Sai Residency 6/2; Owner 2 sees only Green Nest PG)
   - floors and rooms free counts; natural room order
   - each bed status: vacant, paid, partial (day ≤ 5), pending (day ≤ 5), overdue (day 6 for partial and for pending), and a tenant with no current-month row
   - bed detail returns tenant data with current_month; vacant bed returns tenant null; archived tenant never shown
   - manager of Shanti PG gets 404 for Sai Residency (same owner) and for Green Nest PG (other owner); owner 2 gets 404 for owner 1's floor/room/bed ids
   - admin gets 403; malformed ids 404
   - all existing tests still pass

## Rules that matter most
- Status and counts come from the backend only; the app never computes them.
- India time for "today" and the rent month, whatever the server timezone.
- Never return hashes; no write endpoints in this task.

## Out of scope
Pending/partial tab (T-12), past tenants search (T-10), any data entry, admin endpoints (T-03b), mobile screens (T-05b).

## Parallel work note
T-03b runs at the same time and also adds one line to `app.js`. Before pushing, rebase on the latest `main` and keep both route lines.

## Acceptance checklist
- [ ] All 5 endpoints match the contract exactly
- [ ] Bed status table implemented exactly, tested at day 5 and day 6
- [ ] Cross-owner and cross-building access → 404
- [ ] CI green
- [ ] Work Report in the standard format
