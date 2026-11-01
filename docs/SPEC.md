# Technical Spec (v1)

Single source of truth. Changes only through `CHANGES.md`.

## 1. Users

- **Owner**: owns many buildings. View-only, plus: sets season passwords, unlocks managers, receives notifications.
- **Manager**: one per building. Does all data entry for that building.
- **Admin** (our team): onboards owners. Creates owner and manager accounts, sets up buildings, floors, rooms and beds, can switch an owner off. Never enters tenant or payment data.

Platform: one Android app (React Native + Expo) for all three roles; screens depend on the role after login. Many owners share one backend and one database; every query is scoped by owner.

## 2. Data model (PostgreSQL)

10 tables. All ids are UUID. Money is integer rupees. Timestamps are stored UTC, business dates computed in Asia/Kolkata.

### admin
id, name, phone (unique), password_hash, created_at

### owner
id, name, phone (unique), password_hash, is_active (bool, default true; false blocks owner and all their managers), created_at

### building
id, owner_id -> owner, name, address, photo_url (nullable), created_at

### manager
id, owner_id -> owner, building_id -> building (unique: one manager per building), name, phone (unique), password_hash, current_code_hash (season password, set by owner), code_updated_at, failed_attempts (int, default 0), is_locked (bool, default false), is_active (bool), created_at

### floor
id, building_id -> building, floor_number (int), unique(building_id, floor_number)

### room
id, floor_id -> floor, room_number (text), bed_capacity (2 or 3), unique(floor_id, room_number)

### bed
id, room_id -> room, bed_label (A/B/C), unique(room_id, bed_label)

### tenant
id, building_id -> building, bed_id -> bed (nullable, null when archived), name, phone, age, aadhaar_last4 (char 4, nullable), monthly_rent, deposit, start_date, record_status (active | archived), checkout_date (nullable), deposit_returned (nullable), deposit_deduction (nullable), created_by_manager_id -> manager, created_at

Constraint: at most one active tenant per bed (partial unique index on bed_id where record_status = 'active').

### payment
id, tenant_id -> tenant, month (`YYYY-MM`), amount_due, amount_paid (default 0), payment_status (pending | partial | paid), payment_date (nullable), unique(tenant_id, month)

- Status: amount_paid = 0 -> pending; 0 < amount_paid < amount_due -> partial; amount_paid >= amount_due -> paid. Overpayment rejected.
- Overdue is computed, not stored: status != paid and today > 5th of that month.

### transaction_log (append-only)
id, tenant_id -> tenant, manager_id -> manager, building_id -> building, payment_id -> payment (nullable), action_type (check_in | payment | deposit | check_out | deposit_refund | bed_shift), amount (integer, >= 0), payment_mode (cash | upi | null), rent_month (`YYYY-MM`, nullable), note (nullable), created_at

No UPDATE or DELETE ever. Daily collection = sum(payment + deposit) - sum(deposit_refund), grouped by created_at date in Asia/Kolkata.

## 3. Flows

### Check-in
Manager taps a green bed -> form: name, phone, age, aadhaar_last4, monthly_rent, deposit, start_date, first_month_due, amount_paid_now, payment_mode -> season password.
Backend in one DB transaction: create tenant; create payment row for current month with amount_due = first_month_due; apply amount_paid_now; write log rows: check_in (amount 0), deposit (if > 0), payment (if > 0).

### Monthly rows
On the 1st of each month (Asia/Kolkata), create a payment row for every active tenant with amount_due = monthly_rent. Idempotent (unique(tenant_id, month)).

### Collect payment
Manager picks tenant + rent month -> amount + payment_mode -> season password. Backend adds to amount_paid, sets payment_date = today, recomputes status, writes a payment log row.

### Checkout
Manager taps Checkout -> checkout_date, deposit_returned, deposit_deduction -> season password. Tenant becomes archived, bed_id set null, log rows check_out and deposit_refund (if > 0). Unpaid month rows stay as they are.

### Bed shift
Manager picks active tenant -> picks vacant bed in same building -> season password. Tenant.bed_id updated, log row bed_shift (amount 0).

### Season password
Owner sets a numeric code (6 digits) per manager. Stored hashed. Wrong entry increments failed_attempts; at 3 the manager is_locked. Owner unlock resets both. Correct entry resets failed_attempts.

## 4. Screens

Manager: Home (building) -> Floors -> Rooms -> Beds -> Bed detail / Add tenant; Pending tab; Past Tenants search; Collect payment; Checkout; Bed shift.
Owner: Home (all buildings with photo and occupancy) -> same drill-down read-only; Pending tab with tap-to-call; Notifications; Daily digest; Manager settings (set season password, unlock).

Admin: Owners list -> Add owner -> Add building (name, address, photo) -> Add floors -> Add rooms (2 or 3 beds; beds auto-created) -> Add manager; Switch owner on/off.

Bed colours: green vacant, blue paid, yellow partial, red overdue (current month). Pending (not yet overdue) shows blue-outline.

## 5. Notifications

Every payment/deposit log row -> owner phone notification via Expo push (building, tenant, amount, mode, manager, time). Daily digest per building at 21:00 Asia/Kolkata.

## 6. Day-5 calls (Phase 4)

On the 5th at 10:00 Asia/Kolkata, every tenant with current month pending/partial gets an automated reminder call via telephony API. Requires DLT registration.

## 7. Not included

Payment gateway, ID-photo upload, maintenance status, per-bed history table, full Aadhaar storage, web/desktop version.
