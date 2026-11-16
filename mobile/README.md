# Mobile app

One React Native (Expo SDK 58) Android app for Admin, Owner and Manager. JavaScript, Expo Router.

## Run it on your Android phone (Expo Go)

1. Install **Expo Go** from the Play Store on the phone.
2. Phone and laptop must be on the **same Wi-Fi**.
3. Find the laptop's LAN IP:
   - Windows: `ipconfig` → "IPv4 Address" (e.g. `192.168.1.20`)
   - Mac: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
4. In `mobile/`, copy the example env file and put that IP in it:
   ```
   cp .env.example .env
   ```
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
   ```
   Use the port your backend prints when it starts. No `/api` at the end, and never `localhost`
   (on the phone, `localhost` means the phone itself).
5. Install and start:
   ```
   npm install
   npx expo start
   ```
6. Open Expo Go → **Scan QR code** → scan the QR in the terminal. The app opens on the Login screen.

After changing `.env`, stop the server and run `npx expo start --clear` so the new address is picked up.

If the phone cannot connect to the dev server (office or hostel Wi-Fi often blocks it), use
`npx expo start --tunnel`.

### If Expo Go says the project needs a newer SDK

SDK 58 came out on 21 Oct 2026 and the Play Store Expo Go update can lag by a few weeks.
If your Expo Go is too old, connect the phone by USB (USB debugging on), run `npx expo start`
and press `a`: the Expo CLI installs the matching Expo Go on the phone.

## Logging in

Use the sample logins from `backend/README.md` once the backend (T-03) is running, e.g.
Owner `9000000001` / `owner123`. Each role lands on its own home screen. Logout (or any 401 from
the server) returns to Login. The session is kept in the phone's secure storage, so the app
reopens logged in.

## Admin setup (T-05c)

Log in as the Admin (`9000000000` / `admin123` after `npm run db:reset` in `backend/`) to onboard an owner:
Owners → **+ Owner** → owner screen (on/off switch, asks first) → **+ Building** → building screen
(edit name/address/photo link, manager card with add/edit/on-off, floors) → **+ Floor** → tap a floor →
**+ Room** (pick 2 beds or 3 beds; the backend creates beds A/B/C). Owners and managers can never open
these screens (`src/app/admin/` is guarded by role in `src/app/_layout.js`).

## Components screen (developers only)

In development builds the Login screen has a small "Components (dev only)" link that shows every
icon in every state. The route does not exist in release builds (`__DEV__` is false).

## Tests

```
npm test
```

Jest with `jest-expo` and `@testing-library/react-native`. The backend is faked with a mocked
`fetch`, and `expo-secure-store` with an in-memory store (`jest.setup.js`). Tests live in
`src/__tests__/` (not in `src/app/`, where every file is a route).

## Layout

```
src/app/            routes (Expo Router): login, admin/, owner/, manager/, dev-components
src/screens/        screen components used by the routes
src/components/     BuildingIcon, FloorIcon, RoomIcon, BedIcon, BigButton (props only, no API calls)
src/api/client.js   fetch wrapper: base URL, Bearer token, contract errors, 401 -> Login
src/session/        session state + expo-secure-store persistence + role -> home route
src/i18n/en.js      every visible string (Hindi/Marathi files come in T-15)
src/theme.js        colours, font sizes, 56 dp minimum touch size
```

## Notes

- `package.json` has an `overrides` entry pinning `react-dom` to the same version as `react`.
  Expo Router pulls `react-dom` in for web; without the pin npm refuses to install. We do not build for web.
