# PG Management

B2B app (mobile PWA + web) for PG (paying guest) owners and managers in India.
Managers handle check-in, check-out and rent collection. Owners view and track.

**Core principle: extreme simplicity.** Icons over text, one level per screen, usable by a manager with little tech literacy.

## Repo layout

```
backend/    Node.js + Express API, Prisma (PostgreSQL), Jest tests
frontend/   React + Vite PWA (manager and owner screens), Vitest tests
docs/       SPEC, PLAN, TASK_BOARD, DECISIONS, CHANGES, API_CONTRACT
CLAUDE.md   Locked rules every contributor (human or Claude) follows
```

## How work flows

1. One task per branch: `t-xx-short-name`.
2. Tests pass locally, then a Pull Request into `main`.
3. GitHub Actions runs all tests on every push and PR.
4. Product owner tests using the steps in the PR, then merges.
5. `docs/TASK_BOARD.md` is updated with each merged task.

Start with `docs/PLAN.md`, then `docs/SPEC.md`.
