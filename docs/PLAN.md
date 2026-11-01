# Build Plan

## Stack

| Part | Choice |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma |
| Frontend | React + Vite, installable PWA (one codebase for phone and web) |
| Tests | Jest + Supertest (backend), Vitest (frontend) |
| CI | GitHub Actions |
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
| 1. Foundation | T-01 to T-03 | Log in as owner or manager with seed data |
| 2. Core manager app | T-04 to T-11 | Manager runs a PG end to end |
| 3. Owner side | T-12 to T-15 | Owner tracks everything |
| 4. Calling | T-16 | Day-5 reminder calls |
| 5. Launch | T-17 to T-18 | Live app |

Start DLT registration paperwork during Phase 2; approval takes weeks.
