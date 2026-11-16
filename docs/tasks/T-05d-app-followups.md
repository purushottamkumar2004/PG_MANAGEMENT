# T-05d: Small app follow-ups (edit owner, full headers)

- **Worker role:** Mobile UI
- **Branch:** `t-05d-app-followups`
- **Depends on:** T-05b, T-05c merged; T-03d merged (until then, mocks shaped exactly like the contract)
- **Goal:** Two small changes from D-22.

## Deliverables
1. Admin owner screen: an "Edit owner" button opening a form with name, phone (number pad) and new password (empty = keep). Sends only changed fields to `PATCH /api/admin/owners/:ownerId`. Shows `PHONE_TAKEN` clearly.
2. Admin manager edit: when the phone is changed, show a confirm note "New person: the owner must set a new season password." before saving.
3. Drill-down headers use `building_name` from the rooms and beds responses; remove the route-param workaround (`b`) from T-05b.
4. Tests for each, plus all existing tests pass.

## Out of scope
Anything else.

## Acceptance checklist
- [ ] Matches the contract exactly
- [ ] CI green
- [ ] HANDOFF TO MASTER Work Report
