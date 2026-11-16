import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { contractError, mockFetch, storeSession, users } from './helpers';
import { validateBuilding, validateFloorNumber, validatePerson, validateRoom } from '../screens/admin/validation';

// Mocked responses shaped exactly like docs/API_CONTRACT.md "Admin setup" (T-03b).
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const BUILDING_ID = '22222222-2222-4222-8222-222222222222';
const FLOOR_ID = '33333333-3333-4333-8333-333333333333';
const MANAGER_ID = '44444444-4444-4444-8444-444444444444';

const owner = { id: OWNER_ID, name: 'Ramesh Patil', phone: '9000000001', is_active: true, building_count: 1 };
const ownersRes = (o = owner) => ({
  owners: [o, { id: 'o-2', name: 'Sunita Rao', phone: '9000000009', is_active: false, building_count: 0 }],
});
const manager = { id: MANAGER_ID, name: 'Suresh', phone: '9000000002', is_active: true };
const building = (over = {}) => ({
  id: BUILDING_ID,
  name: 'Shanti PG',
  address: 'Kothrud, Pune',
  photo_url: null,
  manager,
  floors: [
    {
      id: FLOOR_ID,
      floor_number: 1,
      rooms: [
        { id: 'r-1', room_number: '101', bed_capacity: 3 },
        { id: 'r-2', room_number: '102', bed_capacity: 2 },
      ],
    },
    { id: 'f-0', floor_number: 0, rooms: [] },
  ],
  ...over,
});
const buildingsRes = (b = building()) => ({ buildings: [b] });

const ME = ['GET', '/api/auth/me', 200, { user: users.admin }];
const OWNERS = ['GET', '/api/admin/owners', 200, ownersRes()];
const BUILDINGS = ['GET', `/api/admin/owners/${OWNER_ID}/buildings`, 200, buildingsRes()];

const OWNER_URL = `/admin/owners/${OWNER_ID}`;
const BUILDING_URL = `${OWNER_URL}/buildings/${BUILDING_ID}`;
const FLOOR_URL = `${BUILDING_URL}/floors/${FLOOR_ID}`;

async function openAs(user, url, routes) {
  await storeSession(user);
  const fetch = mockFetch(routes);
  await renderRouter('./src/app', { initialUrl: url });
  return fetch;
}

const openAdmin = (url, routes) => openAs(users.admin, url, [ME, ...routes]);

// Body of the first call matching method + path.
function sentBody(fetch, method, path) {
  const call = fetch.mock.calls.find(
    ([url, o = {}]) => url === `http://test.local:3000${path}` && (o.method || 'GET') === method
  );
  return call ? JSON.parse(call[1].body) : undefined;
}

async function type(testID, text) {
  await fireEvent.changeText(screen.getByTestId(testID), text);
}

async function press(testID) {
  await fireEvent.press(screen.getByTestId(testID));
}

// The on/off row reports its state to accessibility (and so to tests).
const isOn = (testID) => screen.getByTestId(testID).props.accessibilityState.checked;

afterEach(() => jest.restoreAllMocks());

describe('owners list (admin home)', () => {
  test('shows name, phone, on/off badge and building count', async () => {
    await openAdmin('/admin', [OWNERS]);
    const row = await screen.findByTestId(`owner-row-${OWNER_ID}`);
    expect(row).toHaveTextContent('Ramesh Patil', { exact: false });
    expect(row).toHaveTextContent('9000000001', { exact: false });
    expect(row).toHaveTextContent('1 buildings', { exact: false });
    expect(row).toHaveTextContent('ON', { exact: false });
    expect(screen.getByTestId('owner-row-o-2')).toHaveTextContent('OFF', { exact: false });
    expect(screen.getByTestId('add-owner-button')).toHaveTextContent('Owner', { exact: false });
    expect(screen.getByTestId('logout-button')).toBeOnTheScreen();
  });

  test('empty list shows a hint', async () => {
    await openAdmin('/admin', [['GET', '/api/admin/owners', 200, { owners: [] }]]);
    expect(await screen.findByTestId('owners-empty')).toBeOnTheScreen();
  });

  test('load error shows a message and Retry reloads', async () => {
    const fetch = await openAdmin('/admin', [['GET', '/api/admin/owners', 'NETWORK']]);
    expect(await screen.findByTestId('admin-load-error')).toHaveTextContent('Cannot reach the server', {
      exact: false,
    });
    fetch.mockImplementation(async (url) => ({
      ok: url.endsWith('/api/admin/owners'),
      status: url.endsWith('/api/admin/owners') ? 200 : 404,
      text: async () => JSON.stringify(ownersRes()),
    }));
    await press('admin-retry');
    expect(await screen.findByTestId(`owner-row-${OWNER_ID}`)).toBeOnTheScreen();
  });

  test('tapping an owner opens the owner screen', async () => {
    await openAdmin('/admin', [OWNERS, BUILDINGS]);
    await fireEvent.press(await screen.findByTestId(`owner-row-${OWNER_ID}`));
    expect(await screen.findByTestId('owner-screen')).toBeOnTheScreen();
    expect(screen).toHavePathname(OWNER_URL);
  });
});

describe('add owner form', () => {
  test('phone uses the number pad and keeps digits only', async () => {
    await openAdmin('/admin/owners/new', []);
    const phone = await screen.findByTestId('owner-phone');
    expect(phone.props.keyboardType).toBe('number-pad');
    expect(phone.props.maxLength).toBe(10);
    await type('owner-phone', '90-000 0000a1');
    expect(screen.getByTestId('owner-phone').props.value).toBe('9000000001');
  });

  test('invalid input shows field errors and sends nothing', async () => {
    const fetch = await openAdmin('/admin/owners/new', []);
    await screen.findByTestId('owner-form');
    await type('owner-phone', '12345');
    await type('owner-password', '123');
    await press('owner-save');
    expect(screen.getByTestId('owner-name-error')).toBeOnTheScreen();
    expect(screen.getByTestId('owner-phone-error')).toHaveTextContent('valid 10-digit', { exact: false });
    expect(screen.getByTestId('owner-password-error')).toHaveTextContent('6 to 100', { exact: false });
    expect(fetch.mock.calls.some(([, o]) => o && o.method === 'POST')).toBe(false);
  });

  test('sends the exact contract body and opens the new owner', async () => {
    const created = { id: 'new-owner', name: 'Kiran Joshi', phone: '9876543210', is_active: true };
    const fetch = await openAdmin('/admin/owners/new', [
      ['POST', '/api/admin/owners', 201, { owner: created }],
      ['GET', '/api/admin/owners', 200, { owners: [{ ...created, building_count: 0 }] }],
      ['GET', '/api/admin/owners/new-owner/buildings', 200, { buildings: [] }],
    ]);
    await screen.findByTestId('owner-form');
    await type('owner-name', '  Kiran Joshi ');
    await type('owner-phone', '9876543210');
    await type('owner-password', 'secret1');
    await press('owner-save');
    expect(await screen.findByTestId('owner-screen')).toBeOnTheScreen();
    expect(screen).toHavePathname('/admin/owners/new-owner');
    expect(sentBody(fetch, 'POST', '/api/admin/owners')).toEqual({
      name: 'Kiran Joshi',
      phone: '9876543210',
      password: 'secret1',
    });
    expect(screen.getByTestId('buildings-empty')).toBeOnTheScreen();
  });

  test.each([
    [409, 'PHONE_TAKEN', 'already used by another account'],
    [400, 'VALIDATION_ERROR', 'Some details are not valid'],
    [500, 'INTERNAL', 'Something went wrong'],
  ])('HTTP %s %s shows its message', async (status, code, text) => {
    await openAdmin('/admin/owners/new', [['POST', '/api/admin/owners', status, contractError(code)]]);
    await screen.findByTestId('owner-form');
    await type('owner-name', 'Kiran');
    await type('owner-phone', '9876543210');
    await type('owner-password', 'secret1');
    await press('owner-save');
    expect(await screen.findByTestId('admin-error')).toHaveTextContent(text, { exact: false });
    expect(screen.getByTestId('owner-form')).toBeOnTheScreen();
  });
});

describe('owner screen', () => {
  test('shows the owner, the on/off switch and the buildings', async () => {
    await openAdmin(OWNER_URL, [OWNERS, BUILDINGS]);
    expect(await screen.findByTestId('admin-title')).toHaveTextContent('Ramesh Patil');
    expect(isOn('owner-active')).toBe(true);
    expect(screen.getByTestId(`building-row-${BUILDING_ID}`)).toHaveTextContent('Shanti PG', { exact: false });
    expect(screen.getByTestId(`building-row-${BUILDING_ID}`)).toHaveTextContent('Suresh', { exact: false });
  });

  test('switching off asks first; Cancel sends nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const fetch = await openAdmin(OWNER_URL, [OWNERS, BUILDINGS]);
    await screen.findByTestId('owner-active');
    await press('owner-active');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Switch off this owner?');
    const buttons = alert.mock.calls[0][2];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Yes, switch off']);
    if (buttons[0].onPress) await act(async () => buttons[0].onPress());
    expect(fetch.mock.calls.some(([, o]) => o && o.method === 'PATCH')).toBe(false);
    expect(isOn('owner-active')).toBe(true);
  });

  test('confirming sends { is_active: false } and the switch turns off', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const fetch = await openAdmin(OWNER_URL, [
      OWNERS,
      BUILDINGS,
      ['PATCH', `/api/admin/owners/${OWNER_ID}`, 200, { owner: { ...owner, is_active: false, building_count: undefined } }],
    ]);
    await screen.findByTestId('owner-active');
    // The switch itself also asks first.
    await fireEvent(screen.getByTestId('owner-active-switch'), 'valueChange', false);
    expect(alert).toHaveBeenCalledTimes(1);
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(sentBody(fetch, 'PATCH', `/api/admin/owners/${OWNER_ID}`)).toEqual({ is_active: false });
    await waitFor(() => expect(isOn('owner-active')).toBe(false));
  });

  test('switching an inactive owner on sends { is_active: true }', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const off = { ...owner, is_active: false };
    const fetch = await openAdmin(OWNER_URL, [
      ['GET', '/api/admin/owners', 200, ownersRes(off)],
      BUILDINGS,
      ['PATCH', `/api/admin/owners/${OWNER_ID}`, 200, { owner: { ...off, is_active: true } }],
    ]);
    await screen.findByTestId('owner-active');
    await press('owner-active');
    expect(alert.mock.calls[0][0]).toBe('Switch on this owner?');
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(sentBody(fetch, 'PATCH', `/api/admin/owners/${OWNER_ID}`)).toEqual({ is_active: true });
    await waitFor(() => expect(isOn('owner-active')).toBe(true));
  });

  test('a failed switch shows the error and keeps the old value', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await openAdmin(OWNER_URL, [
      OWNERS,
      BUILDINGS,
      ['PATCH', `/api/admin/owners/${OWNER_ID}`, 404, contractError('NOT_FOUND')],
    ]);
    await screen.findByTestId('owner-active');
    await press('owner-active');
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(await screen.findByTestId('owner-action-error')).toHaveTextContent('Not found', { exact: false });
    expect(isOn('owner-active')).toBe(true);
  });

  test('unknown owner shows Not found', async () => {
    await openAdmin('/admin/owners/nobody', [
      OWNERS,
      ['GET', '/api/admin/owners/nobody/buildings', 404, contractError('NOT_FOUND')],
    ]);
    expect(await screen.findByTestId('admin-load-error')).toHaveTextContent('Not found', { exact: false });
  });

  test('"+ Building" opens the building form; tapping a building opens it', async () => {
    await openAdmin(OWNER_URL, [OWNERS, BUILDINGS]);
    await fireEvent.press(await screen.findByTestId('add-building-button'));
    expect(await screen.findByTestId('building-form')).toBeOnTheScreen();
    expect(screen).toHavePathname(`${OWNER_URL}/buildings/new`);
    await press('admin-back');
    await fireEvent.press(await screen.findByTestId(`building-row-${BUILDING_ID}`));
    expect(await screen.findByTestId('building-screen')).toBeOnTheScreen();
    expect(screen).toHavePathname(BUILDING_URL);
  });
});

describe('building form', () => {
  test('create sends name only when address and photo are empty', async () => {
    const fetch = await openAdmin(`${OWNER_URL}/buildings/new`, [
      ['POST', `/api/admin/owners/${OWNER_ID}/buildings`, 201, {
        building: { id: BUILDING_ID, owner_id: OWNER_ID, name: 'Shanti PG', address: null, photo_url: null },
      }],
      BUILDINGS,
    ]);
    await screen.findByTestId('building-form');
    await type('building-name', 'Shanti PG ');
    await press('building-save');
    expect(await screen.findByTestId('building-screen')).toBeOnTheScreen();
    expect(screen).toHavePathname(BUILDING_URL);
    expect(sentBody(fetch, 'POST', `/api/admin/owners/${OWNER_ID}/buildings`)).toEqual({ name: 'Shanti PG' });
  });

  test('create sends name, address and photo_url', async () => {
    const fetch = await openAdmin(`${OWNER_URL}/buildings/new`, [
      ['POST', `/api/admin/owners/${OWNER_ID}/buildings`, 201, {
        building: { id: BUILDING_ID, owner_id: OWNER_ID, name: 'Shanti PG', address: 'Kothrud', photo_url: 'https://x.in/a.jpg' },
      }],
      BUILDINGS,
    ]);
    await screen.findByTestId('building-form');
    await type('building-name', 'Shanti PG');
    await type('building-address', 'Kothrud');
    await type('building-photo', 'https://x.in/a.jpg');
    await press('building-save');
    await screen.findByTestId('building-screen');
    expect(sentBody(fetch, 'POST', `/api/admin/owners/${OWNER_ID}/buildings`)).toEqual({
      name: 'Shanti PG',
      address: 'Kothrud',
      photo_url: 'https://x.in/a.jpg',
    });
  });

  test('photo link must be https', async () => {
    const fetch = await openAdmin(`${OWNER_URL}/buildings/new`, []);
    await screen.findByTestId('building-form');
    await type('building-name', 'Shanti PG');
    await type('building-photo', 'http://x.in/a.jpg');
    await press('building-save');
    expect(screen.getByTestId('building-photo-error')).toHaveTextContent('https://', { exact: false });
    expect(fetch.mock.calls.some(([, o]) => o && o.method === 'POST')).toBe(false);
  });

  test('server VALIDATION_ERROR shows its message', async () => {
    await openAdmin(`${OWNER_URL}/buildings/new`, [
      ['POST', `/api/admin/owners/${OWNER_ID}/buildings`, 400, contractError('VALIDATION_ERROR')],
    ]);
    await screen.findByTestId('building-form');
    await type('building-name', 'Shanti PG');
    await press('building-save');
    expect(await screen.findByTestId('admin-error')).toHaveTextContent('Some details are not valid', {
      exact: false,
    });
  });

  test('edit is prefilled and sends name, address and photo_url (empty -> null)', async () => {
    const fetch = await openAdmin(BUILDING_URL, [
      BUILDINGS,
      ['PATCH', `/api/admin/buildings/${BUILDING_ID}`, 200, {
        building: { id: BUILDING_ID, owner_id: OWNER_ID, name: 'Shanti PG 2', address: null, photo_url: null },
      }],
    ]);
    await fireEvent.press(await screen.findByTestId('edit-building-button'));
    expect(await screen.findByTestId('building-form')).toBeOnTheScreen();
    expect(screen.getByTestId('building-name').props.value).toBe('Shanti PG');
    expect(screen.getByTestId('building-address').props.value).toBe('Kothrud, Pune');
    await type('building-name', 'Shanti PG 2');
    await type('building-address', '');
    await press('building-save');
    expect(await screen.findByTestId('building-screen')).toBeOnTheScreen();
    expect(sentBody(fetch, 'PATCH', `/api/admin/buildings/${BUILDING_ID}`)).toEqual({
      name: 'Shanti PG 2',
      address: null,
      photo_url: null,
    });
  });
});

describe('building screen', () => {
  test('shows address, photo link, manager card and floors', async () => {
    await openAdmin(BUILDING_URL, [
      ['GET', `/api/admin/owners/${OWNER_ID}/buildings`, 200, buildingsRes(building({ photo_url: 'https://x.in/a.jpg' }))],
    ]);
    expect(await screen.findByTestId('admin-title')).toHaveTextContent('Shanti PG');
    expect(screen.getByTestId('admin-subtitle')).toHaveTextContent('Kothrud, Pune', { exact: false });
    expect(screen.getByTestId('building-photo-url')).toHaveTextContent('https://x.in/a.jpg', { exact: false });
    expect(screen.getByTestId('manager-name')).toHaveTextContent('Suresh');
    expect(screen.getByTestId('manager-phone')).toHaveTextContent('9000000002', { exact: false });
    expect(isOn('manager-active')).toBe(true);
    expect(screen.getByTestId(`floor-row-${FLOOR_ID}`)).toHaveTextContent('Floor 1', { exact: false });
    expect(screen.getByTestId(`floor-row-${FLOOR_ID}`)).toHaveTextContent('2 rooms', { exact: false });
    expect(screen.getByTestId('floor-row-f-0')).toHaveTextContent('Ground floor', { exact: false });
  });

  test('no manager shows "+ Manager"', async () => {
    await openAdmin(BUILDING_URL, [
      ['GET', `/api/admin/owners/${OWNER_ID}/buildings`, 200, buildingsRes(building({ manager: null, floors: [] }))],
    ]);
    expect(await screen.findByTestId('add-manager-button')).toBeOnTheScreen();
    expect(screen.queryByTestId('manager-card')).not.toBeOnTheScreen();
    expect(screen.getByTestId('floors-empty')).toBeOnTheScreen();
  });

  test('manager on/off asks first and sends { is_active: false }', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const fetch = await openAdmin(BUILDING_URL, [
      BUILDINGS,
      ['PATCH', `/api/admin/managers/${MANAGER_ID}`, 200, {
        manager: { ...manager, building_id: BUILDING_ID, is_active: false, has_season_code: false },
      }],
    ]);
    await screen.findByTestId('manager-active');
    await press('manager-active');
    expect(alert.mock.calls[0][0]).toBe('Switch off this manager?');
    expect(fetch.mock.calls.some(([, o]) => o && o.method === 'PATCH')).toBe(false);
    await act(async () => alert.mock.calls[0][2][1].onPress());
    expect(sentBody(fetch, 'PATCH', `/api/admin/managers/${MANAGER_ID}`)).toEqual({ is_active: false });
    await waitFor(() => expect(isOn('manager-active')).toBe(false));
  });

  test('tapping a floor opens the floor screen', async () => {
    await openAdmin(BUILDING_URL, [BUILDINGS]);
    await fireEvent.press(await screen.findByTestId(`floor-row-${FLOOR_ID}`));
    expect(await screen.findByTestId('floor-screen')).toBeOnTheScreen();
    expect(screen).toHavePathname(FLOOR_URL);
  });
});

describe('manager form', () => {
  const noManager = ['GET', `/api/admin/owners/${OWNER_ID}/buildings`, 200, buildingsRes(building({ manager: null }))];

  test('add sends the exact contract body and goes back', async () => {
    const fetch = await openAdmin(BUILDING_URL, [
      noManager,
      ['POST', `/api/admin/buildings/${BUILDING_ID}/manager`, 201, {
        manager: { id: MANAGER_ID, building_id: BUILDING_ID, name: 'Suresh', phone: '9000000002', is_active: true, has_season_code: false },
      }],
    ]);
    await fireEvent.press(await screen.findByTestId('add-manager-button'));
    await screen.findByTestId('manager-form');
    expect(screen.getByTestId('manager-phone-input').props.keyboardType).toBe('number-pad');
    await type('manager-name-input', 'Suresh');
    await type('manager-phone-input', '9000000002');
    await type('manager-password-input', 'mgr123');
    await press('manager-save');
    expect(await screen.findByTestId('building-screen')).toBeOnTheScreen();
    expect(sentBody(fetch, 'POST', `/api/admin/buildings/${BUILDING_ID}/manager`)).toEqual({
      name: 'Suresh',
      phone: '9000000002',
      password: 'mgr123',
    });
  });

  test.each([
    [409, 'MANAGER_EXISTS', 'already has a manager'],
    [409, 'PHONE_TAKEN', 'already used by another account'],
    [400, 'VALIDATION_ERROR', 'Some details are not valid'],
  ])('HTTP %s %s shows its message', async (status, code, text) => {
    await openAdmin(`${BUILDING_URL}/manager`, [
      noManager,
      ['POST', `/api/admin/buildings/${BUILDING_ID}/manager`, status, contractError(code)],
    ]);
    await screen.findByTestId('manager-form');
    await type('manager-name-input', 'Suresh');
    await type('manager-phone-input', '9000000002');
    await type('manager-password-input', 'mgr123');
    await press('manager-save');
    expect(await screen.findByTestId('admin-error')).toHaveTextContent(text, { exact: false });
  });

  test('edit is prefilled and sends only changed fields (empty password = keep)', async () => {
    const fetch = await openAdmin(BUILDING_URL, [
      BUILDINGS,
      ['PATCH', `/api/admin/managers/${MANAGER_ID}`, 200, {
        manager: { ...manager, building_id: BUILDING_ID, phone: '9000000003', has_season_code: false },
      }],
    ]);
    await fireEvent.press(await screen.findByTestId('edit-manager-button'));
    await screen.findByTestId('manager-form');
    expect(screen.getByTestId('manager-name-input').props.value).toBe('Suresh');
    expect(screen.getByTestId('manager-phone-input').props.value).toBe('9000000002');
    await type('manager-phone-input', '9000000003');
    await press('manager-save');
    expect(await screen.findByTestId('building-screen')).toBeOnTheScreen();
    expect(sentBody(fetch, 'PATCH', `/api/admin/managers/${MANAGER_ID}`)).toEqual({ phone: '9000000003' });
  });

  test('edit with a new password sends it', async () => {
    const fetch = await openAdmin(`${BUILDING_URL}/manager`, [
      BUILDINGS,
      ['PATCH', `/api/admin/managers/${MANAGER_ID}`, 409, contractError('PHONE_TAKEN')],
    ]);
    await screen.findByTestId('manager-form');
    await type('manager-name-input', 'Suresh K');
    await type('manager-password-input', 'newpass');
    await press('manager-save');
    expect(await screen.findByTestId('admin-error')).toHaveTextContent('already used', { exact: false });
    expect(sentBody(fetch, 'PATCH', `/api/admin/managers/${MANAGER_ID}`)).toEqual({
      name: 'Suresh K',
      password: 'newpass',
    });
  });
});

describe('floor form', () => {
  test('number pad; sends { floor_number } as a number and goes back', async () => {
    const fetch = await openAdmin(BUILDING_URL, [
      BUILDINGS,
      ['POST', `/api/admin/buildings/${BUILDING_ID}/floors`, 201, {
        floor: { id: 'f-2', building_id: BUILDING_ID, floor_number: 2 },
      }],
    ]);
    await fireEvent.press(await screen.findByTestId('add-floor-button'));
    await screen.findByTestId('floor-form');
    expect(screen.getByTestId('floor-number').props.keyboardType).toBe('number-pad');
    await type('floor-number', '2');
    await press('floor-save');
    expect(await screen.findByTestId('building-screen')).toBeOnTheScreen();
    expect(sentBody(fetch, 'POST', `/api/admin/buildings/${BUILDING_ID}/floors`)).toEqual({ floor_number: 2 });
  });

  test('ground floor 0 is allowed; 201 is not', async () => {
    const fetch = await openAdmin(`${BUILDING_URL}/floors/new`, [
      ['POST', `/api/admin/buildings/${BUILDING_ID}/floors`, 201, {
        floor: { id: 'f-g', building_id: BUILDING_ID, floor_number: 0 },
      }],
    ]);
    await screen.findByTestId('floor-form');
    await type('floor-number', '201');
    await press('floor-save');
    expect(screen.getByTestId('floor-number-error')).toHaveTextContent('0 to 200', { exact: false });
    await type('floor-number', '0');
    await press('floor-save');
    await waitFor(() =>
      expect(sentBody(fetch, 'POST', `/api/admin/buildings/${BUILDING_ID}/floors`)).toEqual({ floor_number: 0 })
    );
  });

  test.each([
    [409, 'CONFLICT', 'floor number already exists'],
    [400, 'VALIDATION_ERROR', 'Some details are not valid'],
  ])('HTTP %s %s shows its message', async (status, code, text) => {
    await openAdmin(`${BUILDING_URL}/floors/new`, [
      ['POST', `/api/admin/buildings/${BUILDING_ID}/floors`, status, contractError(code)],
    ]);
    await screen.findByTestId('floor-form');
    await type('floor-number', '1');
    await press('floor-save');
    expect(await screen.findByTestId('admin-error')).toHaveTextContent(text, { exact: false });
  });
});

describe('floor screen and room form', () => {
  test('floor screen shows rooms with their capacity', async () => {
    await openAdmin(FLOOR_URL, [BUILDINGS]);
    expect(await screen.findByTestId('admin-title')).toHaveTextContent('Floor 1');
    expect(screen.getByTestId('room-r-1')).toHaveTextContent('3 beds', { exact: false });
    expect(screen.getByTestId('room-r-2')).toHaveTextContent('2 beds', { exact: false });
    expect(screen.getAllByTestId('room-r-1-pip')).toHaveLength(3);
  });

  test('2-bed / 3-bed picker: two tiles, one selected at a time, required', async () => {
    const fetch = await openAdmin(`${FLOOR_URL}/rooms/new`, []);
    await screen.findByTestId('room-form');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await type('room-number', '103');
    await press('room-save');
    expect(screen.getByTestId('room-capacity-error')).toHaveTextContent('Choose 2 beds or 3 beds');
    expect(fetch.mock.calls.some(([, o]) => o && o.method === 'POST')).toBe(false);

    await press('capacity-2');
    expect(screen.getByTestId('capacity-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('capacity-3').props.accessibilityState.selected).toBe(false);
    await press('capacity-3');
    expect(screen.getByTestId('capacity-2').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('capacity-3').props.accessibilityState.selected).toBe(true);
  });

  test.each([2, 3])('%s-bed room sends the exact contract body and goes back', async (n) => {
    const labels = ['A', 'B', 'C'].slice(0, n).map((l, i) => ({ id: `b-${i}`, bed_label: l }));
    const fetch = await openAdmin(FLOOR_URL, [
      BUILDINGS,
      ['POST', `/api/admin/floors/${FLOOR_ID}/rooms`, 201, {
        room: { id: 'r-3', floor_id: FLOOR_ID, room_number: '103', bed_capacity: n },
        beds: labels,
      }],
    ]);
    await fireEvent.press(await screen.findByTestId('add-room-button'));
    await screen.findByTestId('room-form');
    await type('room-number', ' 103 ');
    await press(`capacity-${n}`);
    await press('room-save');
    expect(await screen.findByTestId('floor-screen')).toBeOnTheScreen();
    expect(sentBody(fetch, 'POST', `/api/admin/floors/${FLOOR_ID}/rooms`)).toEqual({
      room_number: '103',
      bed_capacity: n,
    });
  });

  test.each([
    [409, 'CONFLICT', 'room number already exists on this floor'],
    [400, 'VALIDATION_ERROR', 'Some details are not valid'],
  ])('HTTP %s %s shows its message', async (status, code, text) => {
    await openAdmin(`${FLOOR_URL}/rooms/new`, [
      ['POST', `/api/admin/floors/${FLOOR_ID}/rooms`, status, contractError(code)],
    ]);
    await screen.findByTestId('room-form');
    await type('room-number', '101');
    await press('capacity-3');
    await press('room-save');
    expect(await screen.findByTestId('admin-error')).toHaveTextContent(text, { exact: false });
  });
});

describe('access', () => {
  test.each([
    ['owner', '/admin', 'home-owner'],
    ['owner', OWNER_URL, 'home-owner'],
    ['manager', BUILDING_URL, 'home-manager'],
    ['manager', `${FLOOR_URL}/rooms/new`, 'home-manager'],
  ])('%s opening %s never reaches admin screens', async (role, url, home) => {
    const fetch = await openAs(users[role], url, [['GET', '/api/auth/me', 200, { user: users[role] }]]);
    expect(await screen.findByTestId(home)).toBeOnTheScreen();
    expect(screen.queryByTestId('home-admin')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('owner-screen')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('building-screen')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('room-form')).not.toBeOnTheScreen();
    expect(fetch.mock.calls.some(([u]) => u.includes('/api/admin/'))).toBe(false);
  });

  test('401 on an admin call returns to Login', async () => {
    await openAdmin('/admin', [['GET', '/api/admin/owners', 401, contractError('UNAUTHORIZED')]]);
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
  });
});

describe('admin validation helpers', () => {
  test('mirror the contract limits', () => {
    expect(validatePerson({ name: 'A', phone: '9000000001', password: '123456' })).toEqual({});
    expect(validatePerson({ name: 'x'.repeat(101), phone: '5000000001', password: '12345' })).toEqual({
      name: 'admin.validation.name',
      phone: 'validation.phoneInvalid',
      password: 'admin.validation.password',
    });
    expect(validatePerson({ name: 'A', phone: '9000000001', password: '' }, { passwordOptional: true })).toEqual({});
    expect(validateBuilding({ name: 'B', address: 'x'.repeat(201), photoUrl: '' })).toEqual({
      address: 'admin.validation.address',
    });
    expect(validateBuilding({ name: 'B', address: '', photoUrl: `https://a.in/${'x'.repeat(500)}` })).toEqual({
      photoUrl: 'admin.validation.photoUrl',
    });
    expect(validateFloorNumber('200')).toEqual({});
    expect(validateFloorNumber('')).toEqual({ floorNumber: 'admin.validation.floorNumber' });
    expect(validateRoom({ roomNumber: 'x'.repeat(11), bedCapacity: 4 })).toEqual({
      roomNumber: 'admin.validation.roomNumber',
      bedCapacity: 'admin.validation.bedCapacity',
    });
  });
});
