# T-03d: Small API follow-ups (admin edits, building_name)

- **Worker role:** Backend
- **Branch:** `t-03d-api-followups`
- **Depends on:** T-03b, T-04, T-06 merged
- **Goal:** Three small contract changes from D-22 / C-05.

## Deliverables
1. `PATCH /api/admin/owners/:ownerId` accepts `phone` (same validation and cross-role uniqueness as create → 409 `PHONE_TAKEN`).
2. `PATCH /api/admin/managers/:managerId`: when `phone` changes to a different number, in the same transaction set `current_code_hash = null`, `code_updated_at = null`, `failed_attempts = 0`, `is_locked = false`. Name/password-only changes keep the code.
3. Add `building_name` to the `floor` object of `GET /api/floors/:floorId/rooms` and the `room` object of `GET /api/rooms/:roomId/beds` without adding extra queries.
4. Tests for each: owner phone change (and the new phone logs in, old one gets 401); phone taken by a manager → 409; manager phone change clears code (gated verify now → 409 `SEASON_CODE_NOT_SET`) and resets lock; name-only change keeps the code; building_name present and correct; query-count test still passes; all existing tests pass.

## Out of scope
Anything else. No schema changes.

## Acceptance checklist
- [ ] Matches `docs/API_CONTRACT.md` exactly
- [ ] CI green
- [ ] HANDOFF TO MASTER Work Report
