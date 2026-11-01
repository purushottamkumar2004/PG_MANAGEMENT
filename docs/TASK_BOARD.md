# Task Board

| ID | Title | Status | Depends on | Notes |
|---|---|---|---|---|
| T-01 | Repo setup, docs, rules, CI | Done | none | Bootstrap commit on main |
| T-02 | Database schema, migrations, seed data | In review | T-01 | Drizzle + PostgreSQL; 10 tables incl. admin; partial unique index for one active tenant per bed; append-only guard on transaction_log |
| T-03 | Login, roles, owner and building scoping | To do | T-02 | JWT; admin / owner / manager; inactive owner blocked; cross-owner isolation tests |
| T-03b | Admin setup: owners, buildings, floors, rooms, beds, managers | To do | T-03 | D-16 |
| T-04 | Read APIs: buildings, floors, rooms, beds with occupancy and bed colours | To do | T-03 | API Contract v1 published first |
| T-05 | Expo app shell + icon drill-down (read-only) | To do | T-04 | Login, building photos, colour-coded beds; test via Expo Go |
| T-06 | Season password: set (owner), verify, 3-try lock, owner unlock | To do | T-03 | D-01, D-10 |
| T-07 | Check-in API + UI with password gate | To do | T-04, T-06 | D-04, D-05 |
| T-08 | Monthly PAYMENT rows + payment marking (partial/paid) | To do | T-07 | Cron on 1st (Asia/Kolkata); D-03 |
| T-09 | Transaction log writes + daily totals | To do | T-07 | D-07 payment mode |
| T-10 | Checkout, archive, deposit settlement, Past Tenants search | To do | T-07 | D-06 |
| T-11 | Bed shift | To do | T-07 | D-08 |
| T-12 | Pending/partial tab with tap-to-call | To do | T-08 | Grouped by rent-month |
| T-13 | Owner read-only views + unlock action | To do | T-04, T-06, T-12 | D-02 |
| T-14 | Owner notifications + daily building-wise digest | To do | T-09 | Expo push |
| T-15 | Hindi and Marathi labels | To do | T-05 | D-09 |
| T-16 | Day-5 automated calls | To do | T-08, T-12 | Telephony API + DLT |
| T-17 | Full regression testing | To do | all | |
| T-18 | Deployment: backend host + Play Store release | To do | T-17 | Google Play developer account needed |
