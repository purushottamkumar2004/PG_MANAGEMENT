# Build Plan

## Stack

| Part | Choice |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL + Drizzle ORM |
| App | React Native + Expo, Android first (Play Store); iPhone later if needed |
| Tests | Vitest + Supertest (backend), Jest (mobile) |
| Hosting | Always-on backend (Render/Railway Singapore or Indian VPS), managed PostgreSQL near India |
| CI | GitHub Actions |
| Notifications | Expo push |
| Calls | Telephony API (Exotel or similar), Phase 4 |

## Workflow

1. Take the next task from `TASK_BOARD.md` whose dependencies are done.
2. Build and test locally.
3. Push to branch `t-xx-name`, open a PR into `main`.
4. CI runs tests. Product owner tests using the PR's test steps, then merges.
5. Update `TASK_BOARD.md`, `DECISIONS.md`, `CHANGES.md` as needed.

An API Contract section is added to `API_CONTRACT.md` before any frontend work on a feature.

## Phases

| Phase | Tasks | Testable result |
|---|---|---|
| 1. Foundation | T-01 to T-03b | Log in as admin, owner or manager; admin sets up a new owner |
| 2. Core manager app | T-04 to T-11 | Manager runs a PG end to end |
| 3. Owner side | T-12 to T-15 | Owner tracks everything |
| 4. Calling | T-16 | Day-5 reminder calls |
| 5. Launch | T-17 to T-18 | App on Play Store, backend live |

Start DLT registration paperwork during Phase 2; approval takes weeks.

During development the app is tested on a real phone with Expo Go (scan QR). Test APKs can be shared before the Play Store release.
