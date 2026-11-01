# Worker Guide (read this first)

You are a WORKER on the PG Management project. You do exactly one task, described in `docs/tasks/<TASK>.md`.
The Master chat plans and reviews. You never change the plan, the schema or the rules on your own.

## Start
1. Clone: `git clone https://x-access-token:<TOKEN>@github.com/purushottamkumar2004/PG_MANAGEMENT.git` (the user gives you the token; never print it).
2. Read, in this order: `CLAUDE.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/API_CONTRACT.md`, your task file in `docs/tasks/`.
3. Create your branch from the latest `main`: the branch name is in your task file.

## While working
- Build only what your task file lists. Anything else goes under "Questions" or "Change Requests" in your report.
- Never edit: `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/CHANGES.md`, `docs/TASK_BOARD.md`, `docs/API_CONTRACT.md`, `CLAUDE.md`, existing migrations. Only Master changes these.
- Follow `docs/API_CONTRACT.md` exactly (paths, field names, error codes). If it is wrong or missing something, raise a Change Request instead of improvising.
- Every feature ships with tests. All tests (old and new) must pass before you push.
- Backend tests need PostgreSQL 16 (`apt-get install -y postgresql`, then create `pg_test`). See `backend/README.md`.

## Finish
1. Push your branch. Open a PR into `main` if your token allows; otherwise give the user the "pull/new/<branch>" link.
2. Put the Work Report in the PR description AND in your final chat message, in this exact format:

```
Task ID and title:
Status: Done / Partially done / Blocked
Branch / PR:
What I built (short):
Files changed:
Schema or API changes I needed (if any):
How to test it (steps):
Test results (count passing):
Assumptions I made:
Questions for Master:
Change Requests (if any):
Next suggested task:
```

The user pastes your report into the Master chat. A task is Done only after Master accepts and the user merges.
