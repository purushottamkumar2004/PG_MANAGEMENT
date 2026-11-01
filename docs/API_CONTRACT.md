# API Contract

Published per feature before frontend work begins. Frontend and backend follow it exactly.
Only Master edits this file. Workers raise a Change Request if something is wrong or missing.

## Conventions

- Base path: `/api`. JSON in and out.
- Auth header: `Authorization: Bearer <token>` on every endpoint except `/api/health` and `/api/auth/login`.
- Errors always: `{ "error": { "code": "STRING_CODE", "message": "human text" } }`
- Common error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403, wrong role), `NOT_FOUND` (404, also used for other owners' data), `CONFLICT` (409), `INTERNAL` (500).
- Money: integer rupees. Dates: `YYYY-MM-DD`. Rent month: `YYYY-MM`. Phone: 10 digits, no +91.
- Never returned anywhere: `password_hash`, `current_code_hash`.

## Health (v1)

`GET /api/health` → 200 `{ "ok": true }`

## Auth (v1, T-03)

### POST /api/auth/login
Request:
```json
{ "phone": "9000000001", "password": "owner123" }
```
- `phone`: 10 digits, starts 6-9. `password`: 1-100 chars.
- Lookup order by phone: admin, then owner, then manager. (Admin setup in T-03b will keep phones unique across all three roles.)

200:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "Ramesh Patil",
    "role": "owner",
    "owner_id": "uuid",
    "building_id": null
  }
}
```
- `role`: `admin` | `owner` | `manager`
- admin: `owner_id` null, `building_id` null. owner: `owner_id` = own id, `building_id` null. manager: both set.

Errors: 400 `VALIDATION_ERROR` · 401 `INVALID_CREDENTIALS` (same for unknown phone and wrong password) · 403 `ACCOUNT_INACTIVE` (owner inactive, or manager inactive, or manager's owner inactive)

JWT payload: `{ sub: user id, role }`, expiry from `JWT_EXPIRES_IN` (default 30d). Owner and building are always re-read from the DB, never taken from the token.

### GET /api/auth/me
200: `{ "user": { same shape as login } }`
Errors: 401 `UNAUTHORIZED` (missing, bad or expired token, or user no longer exists) · 403 `ACCOUNT_INACTIVE`

### POST /api/auth/logout
200: `{ "ok": true }`. Stateless: the app deletes its stored token. (Server-side revocation is out of scope for v1.)
Needs a valid token like every other endpoint (401/403 otherwise). The app deletes its token and returns to Login whatever the response is.

### Notes (D-20)
- A locked manager (`is_locked`, D-01) can still log in and view; the lock only blocks season-password actions (T-06).
- Admin can access buildings of inactive owners (needed to manage or reactivate them).

## Admin setup (v1, T-03b)

All endpoints: role `admin` only (others get 403 `FORBIDDEN`).
Phones must be unique across admin, owner and manager together: 409 `PHONE_TAKEN`.
Validation: `name` 1-100 chars · `password` 6-100 chars · `address` up to 200 · `photo_url` null or an https URL up to 500 · `floor_number` 0-200 · `room_number` 1-10 chars · `bed_capacity` 2 or 3.
No structure deletes in v1 (only add, and switch owners/managers on or off).

### Owners
- `GET /api/admin/owners` → 200 `{ "owners": [ { "id", "name", "phone", "is_active", "building_count" } ] }` (sorted by name)
- `POST /api/admin/owners` `{ "name", "phone", "password" }` → 201 `{ "owner": { "id", "name", "phone", "is_active" } }`
- `PATCH /api/admin/owners/:ownerId` `{ "is_active"?: bool, "name"?: string, "password"?: string }` → 200 `{ "owner": {...} }`

### Buildings and structure
- `GET /api/admin/owners/:ownerId/buildings` → 200
```json
{ "buildings": [ {
  "id": "uuid", "name": "Shanti PG", "address": "Kothrud, Pune", "photo_url": null,
  "manager": { "id": "uuid", "name": "Suresh", "phone": "9000000002", "is_active": true },
  "floors": [ { "id": "uuid", "floor_number": 1,
    "rooms": [ { "id": "uuid", "room_number": "101", "bed_capacity": 3 } ] } ]
} ] }
```
  `manager` is null when none is set. Floors sorted by number; rooms sorted naturally ("2" before "10").
- `POST /api/admin/owners/:ownerId/buildings` `{ "name", "address"?, "photo_url"? }` → 201 `{ "building": { "id", "owner_id", "name", "address", "photo_url" } }`
- `PATCH /api/admin/buildings/:buildingId` `{ "name"?, "address"?, "photo_url"? }` → 200 `{ "building": {...} }`
- `POST /api/admin/buildings/:buildingId/floors` `{ "floor_number" }` → 201 `{ "floor": { "id", "building_id", "floor_number" } }` · 409 `CONFLICT` if the number exists
- `POST /api/admin/floors/:floorId/rooms` `{ "room_number", "bed_capacity" }` → 201 `{ "room": { "id", "floor_id", "room_number", "bed_capacity" }, "beds": [ { "id", "bed_label" } ] }` · beds A/B(/C) created in the same transaction · 409 `CONFLICT` if the room number exists on that floor

### Managers
- `POST /api/admin/buildings/:buildingId/manager` `{ "name", "phone", "password" }` → 201 `{ "manager": { "id", "building_id", "name", "phone", "is_active", "has_season_code": false } }` · 409 `MANAGER_EXISTS` if the building already has one
- `PATCH /api/admin/managers/:managerId` `{ "name"?, "phone"?, "password"?, "is_active"? }` → 200 `{ "manager": {...} }` · used when a manager is replaced (v1 keeps one manager row per building)
- A new manager has no season code until the owner sets one (T-06), so gated actions stay blocked until then.

Unknown or malformed ids → 404 `NOT_FOUND`.

## Structure read (v1, T-04)

Roles `owner` and `manager` only (admin → 403 `FORBIDDEN`; admin uses the admin endpoints).
Scope: owner sees own buildings; manager sees only their building. Anything else → 404 `NOT_FOUND`.

### Bed status (computed, never stored)
For the bed's active tenant and the current rent month in India time (`YYYY-MM`):

| Situation | status |
|---|---|
| no active tenant | `vacant` |
| current month row `paid` | `paid` |
| row `partial`, today's day ≤ 5 | `partial` |
| row `pending` or no row yet, today's day ≤ 5 | `pending` |
| not `paid` and today's day > 5 | `overdue` |

Counts: `total_beds` = beds; `occupied_beds` = beds with an active tenant; `free_beds` = total − occupied.

### GET /api/buildings
200 `{ "buildings": [ { "id", "name", "address", "photo_url", "total_beds", "occupied_beds", "free_beds" } ] }` sorted by name. Manager gets a one-item list.

### GET /api/buildings/:buildingId/floors
200 `{ "building": { "id", "name" }, "floors": [ { "id", "floor_number", "total_beds", "free_beds" } ] }` sorted by floor_number.

### GET /api/floors/:floorId/rooms
200 `{ "floor": { "id", "floor_number", "building_id" }, "rooms": [ { "id", "room_number", "bed_capacity", "free_beds" } ] }` sorted naturally by room_number.

### GET /api/rooms/:roomId/beds
200
```json
{ "room": { "id", "room_number", "bed_capacity", "floor_id", "floor_number", "building_id" },
  "beds": [ { "id": "uuid", "bed_label": "A", "status": "partial",
              "tenant": { "id": "uuid", "name": "Rahul Verma" } } ] }
```
`tenant` is null when vacant. Beds sorted by label.

### GET /api/beds/:bedId
200
```json
{ "bed": { "id", "bed_label", "status", "room_id", "room_number", "floor_number", "building_id", "building_name" },
  "tenant": null }
```
or, when occupied, `tenant`:
```json
{ "id", "name", "phone", "age", "aadhaar_last4", "monthly_rent", "deposit", "start_date",
  "current_month": { "month": "2026-11", "amount_due": 7000, "amount_paid": 3000,
                     "payment_status": "partial", "payment_date": "2026-11-02" } }
```
`current_month` is null if the row does not exist yet. `age` and `aadhaar_last4` may be null. The app shows Aadhaar masked as `XXXX-XXXX-1234`. Owners see the same data read-only (D-02).
