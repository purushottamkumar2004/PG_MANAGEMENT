# T-06: Season password: owner sets it, verify helper, 3-try lock, owner unlock

- **Worker role:** Backend
- **Branch:** `t-06-season-password`
- **Depends on:** T-03 (merged). Runs in parallel with T-03b/T-04 if needed; rebase on latest `main` before pushing.
- **Goal:** The owner controls each manager's 6-digit season code; every future gated action can call one helper that enforces the 3-wrong-tries lock.

## Inputs
- `docs/API_CONTRACT.md` section "Season password" (follow exactly)
- `CLAUDE.md` rules 2 and 4; `docs/DECISIONS.md` D-01, D-10, D-20
- Reuse: `requireAuth`, `requireRole`, error helpers, `manager` columns `current_code_hash`, `code_updated_at`, `failed_attempts`, `is_locked` (already in the schema; no migration needed)

## Deliverables
1. `backend/src/routes/owner.js` (mounted at `/api/owner`) with the 3 owner endpoints.
2. `backend/src/routes/manager.js` (mounted at `/api/manager`) with `GET /status`.
3. `backend/src/lib/seasonCode.js` exporting `verifySeasonCode(managerId, code)`: implements the verification table exactly, in its own transaction with `SELECT ... FOR UPDATE` on the manager row; throws contract errors; resolves on success. Later tasks (T-07 onward) call it before their own transaction.
4. Error helper support for an extra `attempts_left` field in the error body.
5. Tests (Vitest + Supertest), at least:
   - owner sets, changes and unlocks codes for own managers; another owner's manager → 404; manager/admin calling owner endpoints → 403
   - weak codes (`111111`, `123456`, `654321`, 5 or 7 digits, letters) → 400
   - responses never include the hash
   - helper: correct code resets attempts; wrong 1st/2nd → 403 with attempts_left 2/1; wrong 3rd → 423 and locked; locked + correct code → still 423; no code set → 409; bad format → 400 and attempts unchanged
   - concurrency: 5 parallel wrong attempts end with `failed_attempts = 3`, `is_locked = true`, never above 3
   - unlock and new code both reset the lock; `/api/manager/status` reflects every state
   - all existing tests still pass

## Rules that matter most
- Only the owner sets or unlocks (D-10). Admin cannot set codes.
- Never log or return the code or its hash.
- Failed attempts must be saved even when the action is refused.

## Out of scope
Any gated action itself (check-in etc.), mobile screens, automatic code rotation or expiry, SMS of the code.

## Acceptance checklist
- [ ] Endpoints and error codes match the contract exactly
- [ ] Lock reaches exactly 3, also under parallel requests
- [ ] CI green
- [ ] Work Report in the standard format
