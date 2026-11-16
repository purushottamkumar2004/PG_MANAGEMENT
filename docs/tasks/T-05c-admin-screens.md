# T-05c: Admin setup screens

- **Worker role:** Mobile UI
- **Branch:** `t-05c-admin-screens`
- **Depends on:** T-05a (merged), T-03b (merged; until then, mocked responses shaped exactly like the contract)
- **Goal:** Our team can onboard a new PG owner from a phone: owner, buildings, floors, rooms, manager, and switch owners/managers on or off.

## Inputs
- `docs/API_CONTRACT.md` section "Admin setup"
- `docs/SPEC.md` section 4 (Admin screens), D-16
- Existing API client, BigButton, Tile and i18n from T-05a

## Deliverables
1. Owners list (name, phone, on/off badge, building count) with a big "+ Owner" button.
2. Owner screen: on/off switch (with a confirm dialog), buildings list, "+ Building".
3. Building screen: name, address, photo URL field (plain URL for now, T-03c deferred), manager card (add, edit, on/off), floors list with "+ Floor".
4. Floor screen: rooms with capacity, "+ Room" with a 2-bed / 3-bed picker (two big tiles, no free typing).
5. Forms: few fields, numeric keypad for phones and numbers, show contract errors clearly (`PHONE_TAKEN`, `CONFLICT`, `MANAGER_EXISTS`, `VALIDATION_ERROR`).
6. All text in `mobile/src/i18n/en.js`.
7. Tests (mocked fetch): each form sends the exact contract body; each error code shows its message; owner on/off asks for confirmation; 2-bed/3-bed picker; non-admin roles never reach these routes.

## Out of scope
Deleting anything, photo upload, season codes, tenants or payments, Hindi/Marathi.

## Acceptance checklist
- [ ] Full onboarding of a new owner works on a real phone against the T-03b backend
- [ ] Matches the contract exactly
- [ ] CI green
- [ ] Work Report in the standard format
