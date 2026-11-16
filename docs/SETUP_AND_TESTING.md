# Setup and manual testing guide

For the product owner: run the whole app on your laptop and Android phone, then test it by hand.
Takes about 45 minutes the first time, 2 minutes after that.

## What you need

| Thing | Where |
|---|---|
| Laptop (Windows, Mac or Linux) and an Android phone on the **same Wi-Fi** | |
| Git | https://git-scm.com/downloads |
| Node.js **22 LTS** | https://nodejs.org (pick 22.x) |
| PostgreSQL **16** | https://www.postgresql.org/download/ (Windows: the EDB installer) |
| Expo Go app on the phone | Play Store, search "Expo Go" |

Check in a terminal (Windows: PowerShell):
```
git --version
node -v        # must start with v22
psql --version # must say 16.x (Windows: add C:\Program Files\PostgreSQL\16\bin to PATH if not found)
```

## 1. Database (one time)

During the PostgreSQL install you set a password for the `postgres` user. Then:
```
psql -U postgres
```
and paste:
```sql
CREATE USER pg WITH PASSWORD 'pg' SUPERUSER;
CREATE DATABASE pg_dev OWNER pg;
CREATE DATABASE pg_test OWNER pg;
\q
```
`pg_dev` holds the sample data you click through. `pg_test` is wiped by every automated test run, so never put real data in it.

(Docker alternative: `docker run -d --name pgdb -e POSTGRES_USER=pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=pg_dev -p 5432:5432 postgres:16`, then `docker exec -it pgdb createdb -U pg pg_test`.)

## 2. Get the code (one time)
```
git clone https://github.com/purushottamkumar2004/PG_MANAGEMENT.git
cd PG_MANAGEMENT
```
Later, to get the newest version: `git pull` in this folder.

## 3. Backend
```
cd backend
copy .env.example .env      # Mac/Linux: cp .env.example .env
npm ci
npm test                    # automated tests, all must pass
npm run db:reset            # fresh sample data in pg_dev
npm start                   # leave this window open
```
`npm start` prints that the API is listening on port 4000.
Check in the laptop browser: http://localhost:4000/api/health shows `{"ok":true}`.

## 4. Find your laptop's Wi-Fi address
- Windows: `ipconfig` → "Wireless LAN adapter Wi-Fi" → IPv4 Address, e.g. `192.168.1.20`
- Mac: `ipconfig getifaddr en0`

Check on the **phone's browser**: `http://192.168.1.20:4000/api/health` shows `{"ok":true}`.
If it does not load: Windows Firewall is blocking Node. Allow "Node.js" on **Private** networks (Windows Security → Firewall → Allow an app), and make sure the Wi-Fi is set as a Private network.

## 5. Mobile app (second terminal window)
```
cd PG_MANAGEMENT/mobile
copy .env.example .env      # Mac/Linux: cp
```
Edit `mobile/.env` and set your address: `EXPO_PUBLIC_API_URL=http://192.168.1.20:4000` (no `/api` at the end).
```
npm ci
npm test                    # automated tests, all must pass
npx expo start --clear
```
Scan the QR code with Expo Go. If Expo Go says the project needs a newer SDK, see `mobile/README.md`.
If the phone cannot connect at all, try `npx expo start --tunnel`.

## 6. Sample logins

| Role | Phone | Password |
|---|---|---|
| Admin | 9000000000 | admin123 |
| Owner 1 (Shanti PG, Sai Residency) | 9000000001 | owner123 |
| Manager, Shanti PG | 9000000002 | manager123 |
| Manager, Sai Residency | 9000000003 | manager123 |
| Owner 2 (Green Nest PG) | 9000000004 | owner123 |
| Manager, Green Nest PG | 9000000005 | manager123 |

To start fresh at any time: stop the backend (Ctrl+C), `npm run db:reset`, `npm start`.

## 7. Manual test checklist

Bed colours depend on today's date. After the 5th of the month, any unpaid or part-paid bed is **red (overdue)**; on the 1st-5th it shows yellow (part paid) or blue outline (due).

### A. Owner (9000000001)
| # | Do | Expect |
|---|---|---|
| A1 | Log in | Buildings: Shanti PG (6 of 10 free), Sai Residency (4 of 6 free). No Green Nest PG. |
| A2 | Tap Shanti PG | Floor 1 (2 free), Floor 2 (4 free) |
| A3 | Tap Floor 1 | Room 101 (3-bed, wider shape), Room 102 (2-bed) |
| A4 | Tap Room 101 | Bed A Amit (blue, paid), Bed B Rahul (part paid: red after the 5th), Bed C green (free) |
| A5 | Tap Bed A | Name, phone, rent ₹8,000, deposit, Aadhaar `XXXX-XXXX-1234`, this month paid. **No buttons.** |
| A6 | Tap the phone number | Phone dialer opens with Amit's number |
| A7 | Tap a green bed | "This bed is free", **no** Add tenant button (owners never enter data) |
| A8 | Pull down on any screen | Refreshes |
| A9 | Turn Wi-Fi off, pull down | Old data stays, red error banner with Retry. Wi-Fi on, Retry works. |
| A10 | Close the app fully, reopen | Still logged in |
| A11 | Logout | Back to Login |

### B. Manager (9000000002)
| # | Do | Expect |
|---|---|---|
| B1 | Log in | Opens straight on Shanti PG floors (no building list) |
| B2 | Go to a green bed | Big "Add tenant" button, disabled, "Coming soon" |
| B3 | Room 102 | Bed A Vikas: red after the 5th (nothing paid this month) |

### C. Admin (9000000000)
| # | Do | Expect |
|---|---|---|
| C1 | Log in | Owners list: Meena Shah, Ramesh Patil, ON badges, building counts |
| C2 | + Owner: "Test Owner", phone 9111111111, password test123 | New owner opens |
| C3 | + Owner again with phone 9000000002 | Error: phone already used |
| C4 | Test Owner → + Building "Test PG" → + Floor 1 → tap floor → + Room 101, 3-bed | Room shows 3 beds |
| C5 | Same room 101 again | Error: already exists |
| C6 | Building → + Manager: phone 9111111112, password test123 | Manager card appears |
| C7 | Log out, log in as 9111111111 / test123 | Owner sees Test PG, 3 of 3 free |
| C8 | As admin, switch **Meena Shah** OFF (confirm) | Badge OFF |
| C9 | Log in as 9000000004 / owner123 | "Account inactive" message. Also 9000000005 (her manager) blocked. |
| C10 | Switch her back ON | Login works again |

### D. Wrong logins
| # | Do | Expect |
|---|---|---|
| D1 | Phone 12345 | Field error before sending |
| D2 | Right phone, wrong password | "Wrong phone or password" |
| D3 | Backend stopped (Ctrl+C), try login | Network error message, app does not crash |

Season password has no screens yet (owner settings come in T-13); it is covered by automated tests.

## 8. Reporting a problem
Paste into the Master chat: the test number (e.g. "A4"), what you did, what you saw, and a screenshot if possible. Master turns it into a fix task.
