# T-05a: Mobile app shell, login screen, icon components

- **Worker role:** Mobile UI
- **Branch:** `t-05a-mobile-shell`
- **Depends on:** nothing (can run in parallel with T-03); uses the "Auth" section of the API contract
- **Goal:** A runnable Expo Android app with login, role-based home screens and the reusable icon components the whole app will use.

## Inputs
- `CLAUDE.md` (rule 1 simplicity, rule 12 mobile only), `docs/SPEC.md` section 4 (screens, bed colours), `docs/DECISIONS.md` D-09, D-17
- `docs/API_CONTRACT.md` section "Auth"

## Deliverables
1. New Expo project in `mobile/` (latest stable Expo SDK, JavaScript, Expo Router). Android first.
2. API client `mobile/src/api/client.js`: base URL from `EXPO_PUBLIC_API_URL`, adds the Bearer token, turns the contract error shape into a readable error, and on 401 clears the session and returns to Login.
3. Session: token and user saved with `expo-secure-store`; app reopens logged in until logout or 401.
4. Login screen: phone (numeric keypad, 10 digits) and password, one big Login button, clear error text for each contract error code, no other options.
5. Role routing after login: Admin home, Owner home, Manager home. Each is a placeholder screen with the user's name, a big Logout button, and nothing else yet.
6. Icon components in `mobile/src/components/` (props only, no API calls):
   - `BuildingIcon` (photo or placeholder, name, free/total badge)
   - `FloorIcon` (floor number, free-bed count)
   - `RoomIcon` (room number, shape differs for 2-bed vs 3-bed)
   - `BedIcon` (status: vacant green, paid blue, partial yellow, overdue red, pending blue outline)
   - All touch targets at least 56 dp, large text, colour is never the only signal (add an icon or letter).
7. A dev-only "Components" screen showing every icon in every state (reachable only when `__DEV__`).
8. i18n ready: all visible text comes from `mobile/src/i18n/en.js` keys (Hindi/Marathi files come in T-15).
9. Tests with `jest-expo` + `@testing-library/react-native`: login form validation, error display per error code, BedIcon renders the right colour and label for each status, role routing picks the right home.
10. `mobile/README.md`: how to run on a phone with Expo Go (scan QR), how to set `EXPO_PUBLIC_API_URL` to the laptop's LAN IP.

## Rules that matter most
- Simplicity: one action per screen, big icons, minimal text.
- Owner screens never show data-entry buttons.
- No web build, no tablet layouts, no extra UI libraries beyond Expo's own packages, Expo Router, `expo-secure-store`, and the testing libraries above. Anything else needs a Change Request.

## Out of scope
Real building/floor/room/bed data (T-04/T-05b), season password, any data entry, Hindi/Marathi text, notifications.

## Acceptance checklist
- [ ] `npx expo start` runs; app opens in Expo Go on Android
- [ ] Login works against the T-03 backend once it is available (until then, tested with mocked API responses)
- [ ] Each role lands on its own home; logout and 401 both return to Login
- [ ] Components screen shows all icon states
- [ ] `npm test` passes in CI (mobile job, green tick)
- [ ] Work Report delivered in the standard format
