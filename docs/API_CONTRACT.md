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
