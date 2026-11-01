# T-03b: Admin setup API (backend only)

- **Worker role:** Backend
- **Branch:** `t-03b-admin-api`
- **Depends on:** T-03 (merged)
- **Goal:** Our team can onboard a new PG owner end to end through the API: owner account, buildings, floors, rooms (beds auto-created) and the building's manager.

## Inputs
- `docs/API_CONTRACT.md` section "Admin setup" (follow exactly), `docs/SPEC.md` sections 1-2, D-15, D-16, D-20
- Reuse: `requireAuth`, `requireRole('admin')`, error helpers, `createBuildingStructure` idea from `src/db/structure.js` (bed creation), the `uuid` check

## Deliverables
1. `backend/src/routes/admin.js` with every endpoint in "Admin setup", mounted at `/api/admin` in `app.js` (one line).
2. Phone uniqueness across admin, owner and manager, checked inside the same DB transaction as the insert/update → 409 `PHONE_TAKEN`. Also catch the DB unique-violation as a fallback.
3. Room creation inserts the room and its beds (A, B, C up to capacity) in one transaction.
4. Natural sort for room numbers in the structure tree.
5. Passwords hashed with bcryptjs (cost 10). Responses never contain hashes. `has_season_code` = `current_code_hash IS NOT NULL`.
6. Tests (Vitest + Supertest), at least: every endpoint happy path; non-admin roles get 403; duplicate phone across roles (e.g. new owner using a manager's phone) → 409; duplicate floor/room → 409; second manager for a building → 409 `MANAGER_EXISTS`; room with capacity 3 creates beds A/B/C; switching an owner off blocks that owner's login (403 `ACCOUNT_INACTIVE`) and on again restores it; validation errors → 400; unknown ids → 404; all existing tests still pass.

## Rules that matter most
- Admin never touches tenants, payments or the transaction log (locked rule 2).
- Never return `password_hash` or `current_code_hash`.
- All validation with zod on the backend.

## Out of scope
Admin mobile screens (T-05c), building photo upload (photo_url is a plain URL for now), deleting floors/rooms/beds/buildings, season codes (T-06), any tenant data.

## Parallel work note
T-04 runs at the same time and also adds one line to `app.js`. Before pushing, rebase on the latest `main` and keep both route lines.

## Acceptance checklist
- [ ] Every "Admin setup" endpoint matches the contract exactly
- [ ] Phones unique across all three roles
- [ ] Beds auto-created with correct labels
- [ ] Non-admins get 403 on every admin endpoint
- [ ] CI green
- [ ] Work Report in the standard format
