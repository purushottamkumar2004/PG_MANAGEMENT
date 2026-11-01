# T-03: Login, roles, owner and building scoping

- **Worker role:** Backend
- **Branch:** `t-03-auth`
- **Depends on:** T-02 merged into `main`
- **Goal:** Admin, owner and manager can log in; every later endpoint can know who is calling and limit data to their owner and building.

## Inputs
- `docs/SPEC.md` sections 1 and 2 (admin, owner, manager tables)
- `docs/API_CONTRACT.md` section "Auth" (follow it exactly)
- Existing code in `backend/src/db/` and seed logins in `backend/README.md`

## Deliverables
1. Express app: `backend/src/app.js` (exports `app`, no `listen`, so tests can use Supertest) and `backend/src/server.js` (listens on `PORT`, default 4000). Add `npm start` and `npm run dev` scripts.
2. `GET /api/health` and the three auth endpoints from the contract.
3. Middleware in `backend/src/middleware/`:
   - `requireAuth`: verifies JWT, loads the user fresh from the DB on every request, rejects inactive owners and their managers (even with a valid token) and inactive managers.
   - `requireRole(...roles)`
   - attaches `req.user = { id, role, owner_id, building_id }` (admin: owner_id and building_id null; owner: building_id null).
4. Scope helpers in `backend/src/lib/scope.js` that later tasks will use, e.g. `assertBuildingAccess(user, buildingId)`: owner → building must belong to user.owner_id; manager → must equal user.building_id; admin → allowed. Throws a 404 `NOT_FOUND` (not 403) so other owners' ids are not revealed.
5. Central error handler that always returns the contract error shape.
6. Env: `JWT_SECRET` (required, app refuses to start without it), `JWT_EXPIRES_IN` default `30d`. Update `backend/.env.example` and CI env (`JWT_SECRET: test-secret` in `.github/workflows/ci.yml`).
7. Tests (Vitest + Supertest), at least:
   - each seed role logs in; wrong password → 401 `INVALID_CREDENTIALS`; unknown phone → same 401 (no hint which was wrong)
   - invalid body → 400 `VALIDATION_ERROR`
   - `/api/auth/me` with no/bad/expired token → 401 `UNAUTHORIZED`
   - owner set `is_active=false` → owner and their managers get 403 `ACCOUNT_INACTIVE` on login AND on `/me` with an old token
   - scope helper: owner 2 cannot access owner 1's building (404), manager cannot access another building of the same owner (404), admin can access any
   - all 28 existing T-02 tests still pass

## Approved libraries (D-18)
`express`, `jsonwebtoken`, `zod` (input validation), `cors`; dev: `supertest`. Nothing else without a Change Request.

## Rules that matter most
- Locked rules 2, 13 in `CLAUDE.md` (roles, multi-owner isolation).
- Never trust the client for role, owner or building. Always take them from the DB via the token's user id.
- Never return `password_hash` or `current_code_hash` in any response.

## Out of scope
Season password (T-06), admin setup endpoints (T-03b), building/bed APIs (T-04), rate limiting, password reset, mobile app.

## Acceptance checklist
- [ ] All endpoints match `docs/API_CONTRACT.md` "Auth" exactly
- [ ] Inactive owner blocked on login and on every authenticated request
- [ ] Cross-owner and cross-building access returns 404 via the scope helper
- [ ] No secrets or hashes in responses or logs
- [ ] `npm test` passes in CI (green tick)
- [ ] Work Report delivered in the standard format
