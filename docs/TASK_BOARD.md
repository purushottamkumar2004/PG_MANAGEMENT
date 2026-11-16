# Task Board

| ID | Title | Status | Depends on | Notes |
|---|---|---|---|---|
| T-01 | Repo setup, docs, rules, CI | Done | none | Bootstrap commit on main |
| T-02 | Database schema, migrations, seed data | Done | T-01 | Drizzle + PostgreSQL; 10 tables incl. admin; partial unique index for one active tenant per bed; append-only guard on transaction_log |
| T-03 | Login, roles, owner and building scoping | Done | T-02 | JWT; admin / owner / manager; inactive owner blocked; cross-owner isolation tests |
| T-03b | Admin setup API (backend) | Done | T-03 | docs/tasks/T-03b-admin-api.md |
| T-03d | Small API follow-ups (D-22, C-05) | Ready | T-03b, T-04, T-06 | docs/tasks/T-03d-api-followups.md |
| T-05d | Small app follow-ups (edit owner, headers) | Ready | T-05b, T-05c, T-03d | docs/tasks/T-05d-app-followups.md |
| T-03c | Building photo upload | Deferred | T-03b | photo_url is a plain URL until decided |
| T-04 | Structure read APIs with occupancy and bed status | Done | T-03 | docs/tasks/T-04-read-apis.md |
| T-05a | Mobile shell: login, role homes, icon components | Done | none | docs/tasks/T-05a-mobile-shell.md |
| T-05b | Drill-down screens (owner + manager, read-only) | Done | T-04 | docs/tasks/T-05b-drilldown-screens.md; can start on mocks |
| T-05c | Admin setup screens | Done | T-03b | docs/tasks/T-05c-admin-screens.md; can start on mocks |
| T-06 | Season password: set (owner), verify, 3-try lock, owner unlock | Done | T-03 | docs/tasks/T-06-season-password.md |
| T-07 | Check-in API + UI with password gate | To do | T-04, T-06 | D-04, D-05 |
| T-08 | Monthly PAYMENT rows + payment marking (partial/paid) | To do | T-07 | Cron on 1st (Asia/Kolkata); D-03 |
| T-09 | Transaction log writes + daily totals | To do | T-07 | D-07 payment mode |
| T-10 | Checkout, archive, deposit settlement, Past Tenants search | To do | T-07 | D-06 |
| T-11 | Bed shift | To do | T-07 | D-08 |
| T-12 | Pending/partial tab with tap-to-call | To do | T-08 | Grouped by rent-month |
| T-13 | Owner read-only views + unlock action | To do | T-04, T-06, T-12 | D-02 |
| T-14 | Owner notifications + daily building-wise digest | To do | T-09 | Expo push |
| T-15 | Hindi and Marathi labels | To do | T-05a | D-09 |
| T-16 | Day-5 automated calls | To do | T-08, T-12 | Telephony API + DLT |
| T-17 | Full regression testing | To do | all | |
| T-18 | Deployment: backend host + Play Store release | To do | T-17 | Google Play developer account needed; final app name and package id (D-21) |
