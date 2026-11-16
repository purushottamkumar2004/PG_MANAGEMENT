# Decision Log

| ID | Date | Decision | Reason | Affects |
|---|---|---|---|---|
| D-01 | 2026-11-01 | 3 wrong season-password tries lock the manager's gated actions (check-in, check-out, payment, bed shift). Owner unlocks. Viewing stays open. Counter resets on success. | Prevent guessing; owner keeps control | manager.failed_attempts, manager.is_locked; T-02, T-06, T-13 |
| D-02 | 2026-11-01 | Owner sees full tenant details, read-only. | Owner already needs phones for pending tab | T-13 |
| D-03 | 2026-11-01 | Months stay isolated. No carry-over of shortfall. | Matches original design, simpler | payment; T-08 |
| D-04 | 2026-11-01 | Store only last 4 digits of Aadhaar. | UIDAI rules on storing full Aadhaar | tenant.aadhaar_last4; T-02, T-07 |
| D-05 | 2026-11-01 | First month's amount_due is entered by the manager at check-in. From next month, amount_due = monthly_rent, due on the 5th. | Handles mid-month joins without pro-rata maths | payment; T-07, T-08 |
| D-06 | 2026-11-01 | Checkout records deposit_returned and deposit_deduction. | Deposit must be settled on exit | tenant; T-10 |
| D-07 | 2026-11-01 | Every collection records payment_mode: cash or upi. | Owner reconciles cash in hand | transaction_log.payment_mode; T-09 |
| D-08 | 2026-11-01 | Bed shift action moves an active tenant to another vacant bed in the same building. | Avoids fake checkout/check-in | transaction_log action bed_shift; T-11 |
| D-09 | 2026-11-01 | UI labels in English, Hindi, Marathi; icons everywhere. | Low-literacy managers | T-15 |
| D-10 | 2026-11-01 | Only the Owner sets or changes a manager's season password. | Single point of control | T-06 |
| D-11 | 2026-11-01 | Stack: Node/Express, PostgreSQL, GitHub Actions. (ORM and app parts superseded by D-14, D-17) | Team knows JS; money needs relational integrity; one codebase for app + web | all |
| D-12 | 2026-11-01 | Money stored as integer rupees. All dates in Asia/Kolkata. | Avoid float errors and day-boundary bugs | all money tables |
| D-13 | 2026-11-01 | Deferred: emergency contact, WhatsApp/SMS receipts, extra charges. | Keep v1 small | none |
| D-14 | 2026-11-02 | Drizzle ORM instead of Prisma. Backend in plain JavaScript (ESM), tested with Vitest + Supertest. | Lightweight, no engine binary, fast start on small hosts; partial index expressible in schema | T-02 onward |
| D-15 | 2026-11-02 | Multi-owner SaaS: one shared backend and database; every query scoped by owner_id (and building for managers). | Scale to many owners cheaply; one update reaches all | all APIs, T-03 isolation tests |
| D-16 | 2026-11-02 | New Admin role (our team) onboards owners: creates owner/manager accounts, buildings, floors, rooms, beds; owner.is_active switch. | Nobody else can create structure; owner stays view-only | admin table, owner.is_active, T-03b |
| D-17 | 2026-11-02 | Mobile only: one React Native + Expo Android app for admin, owner and manager. Replaces PWA. Expo push for notifications. iPhone later if needed. | Owners and managers use phones, not laptops; Play Store install is familiar | mobile/, T-05 onward, T-14, T-18 |
| D-18 | 2026-11-02 | Approved libraries. Backend: express, jsonwebtoken, zod, cors, bcryptjs; dev: supertest, vitest, drizzle-kit. Mobile: Expo SDK packages, Expo Router, expo-secure-store; dev: jest-expo, @testing-library/react-native. | Keep the app light; stop library sprawl | T-03, T-05a onward |
| D-19 | 2026-11-02 | Work split: Master writes task files in docs/tasks/ and the API contract; worker chats clone the repo, build one task on its own branch, and report back. Only Master edits docs/. | Parallel work without conflicts | all tasks |
| D-20 | 2026-11-02 | T-03 review answers: logout keeps requiring a valid token (app ignores its errors); admin can access inactive owners' buildings; locked manager can log in and view, lock only gates season-password actions. | Simple, consistent with contract and D-01 | T-03, T-05a, T-06 |
| D-21 | 2026-11-16 | T-05a review: stay on Expo SDK 58 (testers without the SDK 58 Expo Go use the USB `npx expo start` + `a` fallback); 401 or ACCOUNT_INACTIVE on any authenticated call logs the app out; app id `in.pgmanagement.app` is provisional until the brand name is decided before T-18; dev deps @react-native/jest-preset and the react-dom npm override are allowed under D-18 (no web build). | Avoid a downgrade/upgrade cycle; consistent session rules; package id cannot change after first Play upload | mobile/, T-05b, T-18 |
| D-22 | 2026-11-16 | Review of T-03b, T-04, T-06, T-05b, T-05c: (1) tenant name under each bed icon is OK; (2) room number keeps the normal keyboard ("G1"); (3) a manager phone change = new person, so season code is cleared and lock reset; (4) admin can change an owner's phone, and the admin app gets an "Edit owner" form (name, phone, password); (5) 423 for an already-locked manager stays without attempts_left, app treats all 423 alike; (6) building_name added to rooms/beds responses (C-05). Items 3, 4, 6 go into follow-up tasks T-03d (backend) and T-05d (mobile). | Owners change numbers; a new manager must not inherit the old code; reliable headers | API_CONTRACT, T-03d, T-05d |
