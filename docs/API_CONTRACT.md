# API Contract

Published per feature before frontend work begins. Frontend and backend follow it exactly.
All responses are JSON. All endpoints need a valid token except `/auth/login`.

## Conventions

- Base path: `/api`
- Auth header: `Authorization: Bearer <token>`
- Errors: `{ "error": { "code": "STRING_CODE", "message": "human text" } }`
- Money: integer rupees. Dates: `YYYY-MM-DD`. Rent month: `YYYY-MM`.

_Sections are added by T-03 (auth) and T-04 onward._
