# T-05b: Icon drill-down screens (owner and manager, read-only)

- **Worker role:** Mobile UI
- **Branch:** `t-05b-drilldown-screens`
- **Depends on:** T-05a (merged), T-04 (merged; until then, build against mocked responses shaped exactly like the contract)
- **Goal:** Owner and manager tap Building → Floors → Rooms → Beds → Bed detail, one level per screen, with real data.

## Inputs
- `docs/API_CONTRACT.md` sections "Structure read" and "Auth"
- `CLAUDE.md` rules 1, 3, 9; `docs/SPEC.md` section 4; D-02, D-21
- Existing components in `mobile/src/components/` (BuildingIcon, FloorIcon, RoomIcon, BedIcon) and the API client

## Deliverables
1. Screens (Expo Router), shared by owner and manager:
   - Buildings grid (owner: all buildings; manager: skips straight to Floors of their one building)
   - Floors, Rooms, Beds screens using the existing icons, two per row, large
   - Bed detail: vacant bed shows a big "Add tenant" button for managers only, disabled with "coming soon" until T-07; occupied bed shows name, tap-to-call phone (`tel:` link), rent, deposit, start date, Aadhaar masked `XXXX-XXXX-1234`, this month's due/paid/status. Owner sees no action buttons at all.
2. Simple header with back arrow and the current place (e.g. "Shanti PG › Floor 1 › Room 101").
3. Pull-to-refresh on every list; loading spinner; friendly error with a Retry button; network error keeps the last data on screen.
4. All new text in `mobile/src/i18n/en.js`.
5. Tests (jest-expo + RNTL with mocked fetch): each screen renders contract data; tapping drills down to the right id; manager skips the building list; owner sees no action buttons; Aadhaar masking; tel: link; error + retry; 401 still returns to Login.

## Rules that matter most
- One level per screen, icons first, minimal text.
- The app never computes bed status or counts; it shows what the API returns.
- No new libraries without a Change Request.

## Out of scope
Any data entry (check-in, payment, checkout), pending tab, admin screens, Hindi/Marathi.

## Acceptance checklist
- [ ] Works on a real Android phone against the T-04 backend with seed data
- [ ] Matches the contract field names exactly
- [ ] CI green
- [ ] Work Report in the standard format
