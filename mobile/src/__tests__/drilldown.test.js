import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { renderRouter } from 'expo-router/testing-library';
import { contractError, mockFetch, storeSession, users } from './helpers';
import {
  bedsRes,
  buildingsRes,
  floorsRes,
  managerFloorsRes,
  occupiedBedRes,
  occupiedNoRowBedRes,
  roomsRes,
  vacantBedRes,
} from './fixtures';

const APP_DIR = './src/app';
const me = (user) => ['GET', '/api/auth/me', 200, { user }];

const ownerRoutes = () => [
  me(users.owner),
  ['GET', '/api/buildings', 200, buildingsRes],
  ['GET', '/api/buildings/b2/floors', 200, floorsRes],
  ['GET', '/api/floors/f1/rooms', 200, roomsRes],
  ['GET', '/api/rooms/r1/beds', 200, bedsRes],
  ['GET', '/api/beds/bedA', 200, occupiedBedRes],
  ['GET', '/api/beds/bedB', 200, vacantBedRes],
  ['GET', '/api/beds/bedC', 200, occupiedNoRowBedRes],
];

const managerRoutes = () => [
  me(users.manager),
  ['GET', '/api/buildings/b1/floors', 200, managerFloorsRes],
  ['GET', '/api/beds/bedA', 200, occupiedBedRes],
  ['GET', '/api/beds/bedB', 200, vacantBedRes],
  ['GET', '/api/beds/bedC', 200, occupiedNoRowBedRes],
];

async function openAs(user, routes, initialUrl = '/') {
  await storeSession(user);
  const fetch = mockFetch(routes);
  await renderRouter(APP_DIR, { initialUrl });
  return fetch;
}

const called = (fetch, path) => fetch.mock.calls.some(([url]) => url.endsWith(path));
const place = () => screen.getByTestId('place-title');

function storedToken() {
  return require('expo-secure-store').__store.get('pg.session.token');
}

describe('owner drill-down', () => {
  test('owner home is the buildings grid from the contract data', async () => {
    const fetch = await openAs(users.owner, ownerRoutes());
    expect(await screen.findByTestId('building-b2')).toBeOnTheScreen();
    expect(screen.getByTestId('home-owner')).toBeOnTheScreen();
    expect(screen.getByTestId('building-b1')).toHaveTextContent('Sai Residency', { exact: false });
    expect(screen.getByTestId('building-b1-badge')).toHaveTextContent('0/6 free');
    expect(screen.getByTestId('building-b2-badge')).toHaveTextContent('6/10 free');
    expect(screen.getByTestId('building-b2-photo')).toBeOnTheScreen();
    expect(screen.getByTestId('building-b1-placeholder')).toBeOnTheScreen();
    expect(place()).toHaveTextContent('My buildings');
    expect(screen.getByTestId('home-greeting')).toHaveTextContent('Hello, Ramesh Patil');
    expect(screen.queryByTestId('back-button')).not.toBeOnTheScreen();
    expect(screen.getByTestId('logout-button')).toBeOnTheScreen();
    expect(fetch.mock.calls.find(([url]) => url.endsWith('/api/buildings'))[1].headers.Authorization).toBe(
      'Bearer stored-token'
    );
  });

  test('tapping a building opens its floors', async () => {
    const fetch = await openAs(users.owner, ownerRoutes());
    await fireEvent.press(await screen.findByTestId('building-b2'));
    expect(await screen.findByTestId('floor-f1')).toBeOnTheScreen();
    expect(screen).toHavePathname('/building/b2');
    expect(called(fetch, '/api/buildings/b2/floors')).toBe(true);
    expect(place()).toHaveTextContent('Shanti PG');
    expect(screen.getByTestId('floor-f0')).toHaveTextContent('Ground floor', { exact: false });
    expect(screen.getByTestId('floor-f1')).toHaveTextContent('4 free', { exact: false });
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
  });

  test('full path Building → Floor → Room → Beds → Bed with the place in the header', async () => {
    const fetch = await openAs(users.owner, ownerRoutes());
    await fireEvent.press(await screen.findByTestId('building-b2'));
    await fireEvent.press(await screen.findByTestId('floor-f1'));

    expect(await screen.findByTestId('room-r1')).toBeOnTheScreen();
    expect(screen).toHavePathname('/floor/f1');
    expect(called(fetch, '/api/floors/f1/rooms')).toBe(true);
    expect(place()).toHaveTextContent('Shanti PG › Floor 1');
    expect(screen.getByTestId('room-r1')).toHaveTextContent('3 beds', { exact: false });
    expect(screen.getAllByTestId('room-r2-pip')).toHaveLength(2);

    await fireEvent.press(screen.getByTestId('room-r1'));
    expect(await screen.findByTestId('bed-bedA')).toBeOnTheScreen();
    expect(screen).toHavePathname('/room/r1');
    expect(called(fetch, '/api/rooms/r1/beds')).toBe(true);
    expect(place()).toHaveTextContent('Shanti PG › Floor 1 › Room 101');
    // Status comes straight from the API.
    expect(screen.getByTestId('bed-bedA-status')).toHaveTextContent('Part paid');
    expect(screen.getByTestId('bed-bedB-status')).toHaveTextContent('Free');
    expect(screen.getByTestId('bed-bedC-status')).toHaveTextContent('Overdue');
    expect(screen.getByTestId('bed-bedA-tenant')).toHaveTextContent('Rahul Verma', { exact: false });
    expect(screen.queryByTestId('bed-bedB-tenant')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('bed-bedA'));
    expect(await screen.findByTestId('tenant-name')).toBeOnTheScreen();
    expect(screen).toHavePathname('/bed/bedA');
    expect(called(fetch, '/api/beds/bedA')).toBe(true);
    expect(place()).toHaveTextContent('Shanti PG › Floor 1 › Room 101 › Bed A');
  });

  test('back arrow returns one level', async () => {
    await openAs(users.owner, ownerRoutes());
    await fireEvent.press(await screen.findByTestId('building-b2'));
    await fireEvent.press(await screen.findByTestId('floor-f1'));
    await screen.findByTestId('room-r1');
    await fireEvent.press(screen.getByTestId('back-button'));
    expect(await screen.findByTestId('floor-f1')).toBeOnTheScreen();
    expect(screen).toHavePathname('/building/b2');
  });

  test('occupied bed shows tenant details read-only, with no action buttons', async () => {
    await openAs(users.owner, ownerRoutes(), '/bed/bedA');
    expect(await screen.findByTestId('tenant-name')).toHaveTextContent('Rahul Verma', { exact: false });
    expect(screen.getByTestId('tenant-age')).toHaveTextContent('24');
    expect(screen.getByTestId('tenant-rent')).toHaveTextContent('₹7,000');
    expect(screen.getByTestId('tenant-deposit')).toHaveTextContent('₹1,25,000');
    expect(screen.getByTestId('tenant-start')).toHaveTextContent('01 Oct 2026');
    expect(screen.getByTestId('tenant-aadhaar')).toHaveTextContent('XXXX-XXXX-5678');
    expect(screen.getByTestId('current-month')).toHaveTextContent('This month: Nov 2026', { exact: false });
    expect(screen.getByTestId('month-due')).toHaveTextContent('₹7,000');
    expect(screen.getByTestId('month-paid')).toHaveTextContent('₹3,000');
    expect(screen.getByTestId('month-status')).toHaveTextContent('Part paid');
    expect(screen.getByTestId('month-paid-on')).toHaveTextContent('02 Nov 2026');
    expect(screen.getByTestId('bed-detail-icon-status')).toHaveTextContent('Part paid');
    // Only the back arrow is a button; the phone is a link.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
    expect(screen.queryByTestId('add-tenant-button')).not.toBeOnTheScreen();
  });

  test('phone is a tap-to-call tel: link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openAs(users.owner, ownerRoutes(), '/bed/bedA');
    const phone = await screen.findByTestId('tenant-phone');
    expect(phone).toHaveTextContent('9876500002', { exact: false });
    expect(screen.getByRole('link', { name: 'Call Rahul Verma' })).toBeOnTheScreen();
    await fireEvent.press(phone);
    expect(open).toHaveBeenCalledWith('tel:9876500002');
    open.mockRestore();
  });

  test('owner sees a vacant bed with no Add tenant button', async () => {
    await openAs(users.owner, ownerRoutes(), '/bed/bedB');
    expect(await screen.findByTestId('bed-free')).toHaveTextContent('This bed is free');
    expect(screen.queryByTestId('add-tenant-button')).not.toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  test('floor opened without the building name still shows the floor', async () => {
    await openAs(users.owner, ownerRoutes(), '/floor/f1');
    await screen.findByTestId('room-r1');
    expect(place()).toHaveTextContent('Floor 1');
  });
});

describe('manager drill-down', () => {
  test('manager home skips the building list and shows the floors of their building', async () => {
    const fetch = await openAs(users.manager, managerRoutes());
    expect(await screen.findByTestId('floor-f9')).toBeOnTheScreen();
    expect(screen.getByTestId('home-manager')).toBeOnTheScreen();
    expect(screen).toHavePathname('/manager');
    expect(called(fetch, '/api/buildings/b1/floors')).toBe(true);
    expect(called(fetch, '/api/buildings')).toBe(false);
    expect(place()).toHaveTextContent('Sai Residency');
    expect(screen.getByTestId('home-greeting')).toHaveTextContent('Hello, Suresh Kale');
    expect(screen.queryByTestId('back-button')).not.toBeOnTheScreen();
  });

  test('tapping a floor from the manager home drills into it', async () => {
    const routes = [...managerRoutes(), ['GET', '/api/floors/f9/rooms', 200, { ...roomsRes, floor: { id: 'f9', floor_number: 1, building_id: 'b1' } }]];
    await openAs(users.manager, routes);
    await fireEvent.press(await screen.findByTestId('floor-f9'));
    expect(await screen.findByTestId('room-r1')).toBeOnTheScreen();
    expect(screen).toHavePathname('/floor/f9');
    expect(place()).toHaveTextContent('Sai Residency › Floor 1');
  });

  test('vacant bed shows a disabled Add tenant button marked coming soon', async () => {
    await openAs(users.manager, managerRoutes(), '/bed/bedB');
    const button = await screen.findByTestId('add-tenant-button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Add tenant', { exact: false });
    expect(screen.getByTestId('add-tenant-soon')).toHaveTextContent('Coming soon');
    await fireEvent.press(button);
    expect(screen).toHavePathname('/bed/bedB');
  });

  test('occupied bed with no bill yet and no Aadhaar/age', async () => {
    await openAs(users.manager, managerRoutes(), '/bed/bedC');
    expect(await screen.findByTestId('tenant-name')).toHaveTextContent('Amit Kumar', { exact: false });
    expect(screen.getByTestId('current-month-none')).toHaveTextContent('No bill for this month yet');
    expect(screen.getByTestId('tenant-aadhaar')).toHaveTextContent('—');
    expect(screen.queryByTestId('tenant-age')).not.toBeOnTheScreen();
    expect(screen.getByTestId('bed-detail-icon-status')).toHaveTextContent('Overdue');
    expect(screen.queryByTestId('add-tenant-button')).not.toBeOnTheScreen();
  });
});

describe('loading, errors and refresh', () => {
  test('shows a spinner while loading', async () => {
    await storeSession(users.owner);
    let release;
    global.fetch = jest.fn((url) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ user: users.owner }) });
      return new Promise((resolve) => {
        release = () => resolve({ ok: true, status: 200, text: async () => JSON.stringify(buildingsRes) });
      });
    });
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('screen-loading')).toBeOnTheScreen();
    await waitFor(() => expect(release).toBeDefined());
    await act(async () => release());
    expect(await screen.findByTestId('building-b1')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-loading')).not.toBeOnTheScreen();
  });

  test('error on first load shows a friendly message and Retry loads the data', async () => {
    const routes = ownerRoutes();
    const buildingsRoute = routes.find((r) => r[1] === '/api/buildings');
    buildingsRoute[2] = 'NETWORK';
    await openAs(users.owner, routes);
    expect(await screen.findByTestId('screen-error-text')).toHaveTextContent('Cannot reach the server', { exact: false });
    expect(screen.getByTestId('logout-button')).toBeOnTheScreen();

    buildingsRoute[2] = 200;
    await fireEvent.press(screen.getByTestId('retry-button'));
    expect(await screen.findByTestId('building-b2')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-error')).not.toBeOnTheScreen();
  });

  test('404 shows "Not found" with Retry', async () => {
    await openAs(users.owner, [me(users.owner), ['GET', '/api/beds/zzz', 404, contractError('NOT_FOUND')]], '/bed/zzz');
    expect(await screen.findByTestId('screen-error-text')).toHaveTextContent('Not found');
    expect(screen.getByTestId('retry-button')).toBeOnTheScreen();
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
  });

  test('pull-to-refresh reloads the list', async () => {
    const routes = ownerRoutes();
    const bedsRoute = routes.find((r) => r[1] === '/api/rooms/r1/beds');
    const fetch = await openAs(users.owner, routes, '/room/r1');
    expect(await screen.findByTestId('bed-bedB-status')).toHaveTextContent('Free');

    bedsRoute[3] = {
      ...bedsRes,
      beds: bedsRes.beds.map((b) => (b.id === 'bedB' ? { ...b, status: 'pending', tenant: { id: 't9', name: 'New Guy' } } : b)),
    };
    const before = fetch.mock.calls.filter(([u]) => u.endsWith('/api/rooms/r1/beds')).length;
    await fireEvent(screen.getByTestId('beds-screen-list'), 'refresh');
    await waitFor(() => expect(screen.getByTestId('bed-bedB-status')).toHaveTextContent('Due'));
    expect(screen.getByTestId('bed-bedB-tenant')).toHaveTextContent('New Guy');
    expect(fetch.mock.calls.filter(([u]) => u.endsWith('/api/rooms/r1/beds')).length).toBe(before + 1);
  });

  test('network error on refresh keeps the last data on screen', async () => {
    const routes = ownerRoutes();
    const floorsRoute = routes.find((r) => r[1] === '/api/buildings/b2/floors');
    await openAs(users.owner, routes, '/building/b2');
    expect(await screen.findByTestId('floor-f1')).toBeOnTheScreen();

    floorsRoute[2] = 'NETWORK';
    await fireEvent(screen.getByTestId('floors-screen-list'), 'refresh');
    expect(await screen.findByTestId('error-banner')).toHaveTextContent('Cannot reach the server', { exact: false });
    expect(screen.getByTestId('floor-f1')).toBeOnTheScreen();
    expect(screen.getByTestId('floor-f0')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-error')).not.toBeOnTheScreen();

    floorsRoute[2] = 200;
    await fireEvent.press(screen.getByTestId('banner-retry-button'));
    await waitFor(() => expect(screen.queryByTestId('error-banner')).not.toBeOnTheScreen());
    expect(screen.getByTestId('floor-f1')).toBeOnTheScreen();
  });

  test('bed detail refresh failure keeps the tenant on screen', async () => {
    const routes = ownerRoutes();
    const bedRoute = routes.find((r) => r[1] === '/api/beds/bedA');
    await openAs(users.owner, routes, '/bed/bedA');
    await screen.findByTestId('tenant-name');
    bedRoute[2] = 'NETWORK';
    const scroll = screen.getByTestId('bed-detail-scroll');
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByTestId('error-banner')).toBeOnTheScreen();
    expect(screen.getByTestId('tenant-name')).toHaveTextContent('Rahul Verma', { exact: false });
  });

  test('401 on a drill-down call returns to Login and clears the session', async () => {
    const routes = ownerRoutes();
    routes.find((r) => r[1] === '/api/buildings/b2/floors')[2] = 401;
    routes.find((r) => r[1] === '/api/buildings/b2/floors')[3] = contractError('UNAUTHORIZED');
    await openAs(users.owner, routes);
    await fireEvent.press(await screen.findByTestId('building-b2'));
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(screen).toHavePathname('/login');
    expect(storedToken()).toBeUndefined();
  });

  test('ACCOUNT_INACTIVE on a drill-down call returns to Login', async () => {
    await openAs(users.manager, [
      me(users.manager),
      ['GET', '/api/buildings/b1/floors', 403, contractError('ACCOUNT_INACTIVE')],
    ]);
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(storedToken()).toBeUndefined();
  });
});

describe('route guards', () => {
  test('admin cannot open drill-down screens', async () => {
    const fetch = await openAs(users.admin, [me(users.admin)], '/building/b1');
    expect(await screen.findByTestId('home-admin')).toBeOnTheScreen();
    expect(called(fetch, '/api/buildings/b1/floors')).toBe(false);
  });

  test('logged-out user opening a bed link lands on Login', async () => {
    mockFetch([]);
    await renderRouter(APP_DIR, { initialUrl: '/bed/bedA' });
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
  });

  test('logout from the owner home returns to Login', async () => {
    await openAs(users.owner, [...ownerRoutes(), ['POST', '/api/auth/logout', 200, { ok: true }]]);
    await screen.findByTestId('building-b1');
    await fireEvent.press(screen.getByTestId('logout-button'));
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(storedToken()).toBeUndefined();
  });
});

