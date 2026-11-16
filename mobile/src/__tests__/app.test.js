import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { contractError, mockFetch, storeSession, users } from './helpers';

const APP_DIR = './src/app';

async function renderApp(initialUrl = '/') {
  return renderRouter(APP_DIR, { initialUrl });
}

async function fillAndLogin(phone, password) {
  await fireEvent.changeText(screen.getByTestId('login-phone'), phone);
  await fireEvent.changeText(screen.getByTestId('login-password'), password);
  await fireEvent.press(screen.getByTestId('login-button'));
}

function storedValues() {
  const store = require('expo-secure-store').__store;
  return { token: store.get('pg.session.token'), user: store.get('pg.session.user') };
}

describe('login screen', () => {
  test('starts on Login when nobody is logged in', async () => {
    await renderApp();
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(screen).toHavePathname('/login');
  });

  test('phone field keeps digits only and uses the number pad', async () => {
    await renderApp();
    const phone = await screen.findByTestId('login-phone');
    expect(phone.props.keyboardType).toBe('number-pad');
    expect(phone.props.maxLength).toBe(10);
    await fireEvent.changeText(phone, '98a76-54 32109');
    expect(screen.getByTestId('login-phone').props.value).toBe('9876543210');
  });

  test('validation errors show and no request is sent', async () => {
    const fetch = mockFetch([]);
    await renderApp();
    await screen.findByTestId('login-button');
    await fillAndLogin('12345', '');
    expect(screen.getByTestId('login-phone-error')).toHaveTextContent('Enter a valid 10-digit mobile number');
    expect(screen.getByTestId('login-password-error')).toHaveTextContent('Enter your password');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('empty phone shows "required"', async () => {
    await renderApp();
    await screen.findByTestId('login-button');
    await fillAndLogin('', 'x');
    expect(screen.getByTestId('login-phone-error')).toHaveTextContent('Enter your mobile number');
  });

  test.each([
    [401, 'INVALID_CREDENTIALS', 'Wrong mobile number or password'],
    [403, 'ACCOUNT_INACTIVE', 'This account is switched off. Please contact your owner or support.'],
    [400, 'VALIDATION_ERROR', 'Please check the mobile number and password'],
    [500, 'INTERNAL', 'Something went wrong. Please try again.'],
  ])('HTTP %s %s shows a clear message', async (status, code, text) => {
    mockFetch([['POST', '/api/auth/login', status, contractError(code)]]);
    await renderApp();
    await screen.findByTestId('login-button');
    await fillAndLogin('9000000001', 'owner123');
    expect(await screen.findByTestId('login-error')).toHaveTextContent(text, { exact: false });
    expect(screen).toHavePathname('/login');
    expect(storedValues().token).toBeUndefined();
  });

  test('network failure shows a connection message', async () => {
    mockFetch([['POST', '/api/auth/login', 'NETWORK']]);
    await renderApp();
    await screen.findByTestId('login-button');
    await fillAndLogin('9000000001', 'owner123');
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Cannot reach the server', {
      exact: false,
    });
  });
});

describe('role routing', () => {
  test.each([
    ['admin', '/admin', 'Asha Admin'],
    ['owner', '/owner', 'Ramesh Patil'],
    ['manager', '/manager', 'Suresh Kale'],
  ])('%s logs in and lands on its own home', async (role, path, name) => {
    mockFetch([
      ['POST', '/api/auth/login', 200, { token: `tok-${role}`, user: users[role] }],
      ['GET', '/api/buildings', 200, { buildings: [] }],
      ['GET', '/api/buildings/b1/floors', 200, { building: { id: 'b1', name: 'Sai Residency' }, floors: [] }],
    ]);
    await renderApp();
    await screen.findByTestId('login-button');
    await fillAndLogin('9000000001', 'secret');

    expect(await screen.findByTestId(`home-${role}`)).toBeOnTheScreen();
    expect(screen).toHavePathname(path);
    expect(screen.getByTestId('home-greeting')).toHaveTextContent(`Hello, ${name}`);
    expect(storedValues().token).toBe(`tok-${role}`);
    expect(JSON.parse(storedValues().user).role).toBe(role);
  });

  test('a user cannot open another role\'s home', async () => {
    await storeSession(users.manager);
    mockFetch([['GET', '/api/auth/me', 200, { user: users.manager }]]);
    await renderApp('/owner');
    expect(await screen.findByTestId('home-manager')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-owner')).not.toBeOnTheScreen();
  });

  // Owner and manager homes are the drill-down screens since T-05b (see drilldown.test.js).
  test('admin home is the owners list (T-05c): greeting, + Owner and Logout', async () => {
    await storeSession(users.admin);
    mockFetch([
      ['GET', '/api/auth/me', 200, { user: users.admin }],
      ['GET', '/api/admin/owners', 200, { owners: [] }],
    ]);
    await renderApp();
    await screen.findByTestId('home-admin');
    expect(await screen.findByTestId('owners-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('home-greeting')).toHaveTextContent('Hello, Asha Admin');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Owner/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Logout/ })).toBeOnTheScreen();
  });
});

describe('session', () => {
  test('app reopens logged in from secure storage', async () => {
    await storeSession(users.owner, 'saved');
    const fetch = mockFetch([['GET', '/api/auth/me', 200, { user: { ...users.owner, name: 'Ramesh P.' } }]]);
    await renderApp();
    expect(await screen.findByTestId('home-owner')).toBeOnTheScreen();
    // /me is called with the stored token and refreshes the name.
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer saved');
    await waitFor(() => expect(screen.getByTestId('home-greeting')).toHaveTextContent('Hello, Ramesh P.'));
  });

  test('app stays logged in when offline at start', async () => {
    await storeSession(users.manager);
    mockFetch([['GET', '/api/auth/me', 'NETWORK']]);
    await renderApp();
    expect(await screen.findByTestId('home-manager')).toBeOnTheScreen();
    await act(async () => {});
    expect(screen.getByTestId('home-manager')).toBeOnTheScreen();
  });

  test('logout clears storage and returns to Login', async () => {
    await storeSession(users.manager);
    const fetch = mockFetch([
      ['GET', '/api/auth/me', 200, { user: users.manager }],
      ['POST', '/api/auth/logout', 200, { ok: true }],
    ]);
    await renderApp();
    await screen.findByTestId('home-manager');
    await fireEvent.press(screen.getByTestId('logout-button'));

    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(screen).toHavePathname('/login');
    expect(storedValues()).toEqual({ token: undefined, user: undefined });
    expect(fetch.mock.calls.some(([url, o]) => url.endsWith('/api/auth/logout') && o.method === 'POST')).toBe(true);
  });

  test('logout still works when the server is unreachable', async () => {
    await storeSession(users.admin);
    mockFetch([
      ['GET', '/api/auth/me', 200, { user: users.admin }],
      ['POST', '/api/auth/logout', 'NETWORK'],
    ]);
    await renderApp();
    await screen.findByTestId('home-admin');
    await fireEvent.press(screen.getByTestId('logout-button'));
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(storedValues().token).toBeUndefined();
  });

  test('401 from the server clears the session and returns to Login', async () => {
    await storeSession(users.owner, 'expired');
    mockFetch([['GET', '/api/auth/me', 401, contractError('UNAUTHORIZED')]]);
    await renderApp();
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(screen).toHavePathname('/login');
    expect(storedValues().token).toBeUndefined();
  });

  test('switched-off account (ACCOUNT_INACTIVE on /me) is logged out', async () => {
    await storeSession(users.manager);
    mockFetch([['GET', '/api/auth/me', 403, contractError('ACCOUNT_INACTIVE')]]);
    await renderApp();
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(storedValues().token).toBeUndefined();
  });

  test('stored session with an unknown role is discarded', async () => {
    await storeSession({ ...users.owner, role: 'superuser' });
    await renderApp();
    expect(await screen.findByTestId('login-button')).toBeOnTheScreen();
    expect(storedValues().token).toBeUndefined();
  });
});

describe('dev components screen', () => {
  test('shows every icon in every state (dev build)', async () => {
    await renderApp('/dev-components');
    expect(await screen.findByTestId('dev-components-screen')).toBeOnTheScreen();
    ['vacant', 'paid', 'partial', 'overdue', 'pending'].forEach((s) =>
      expect(screen.getByTestId(`dev-bed-${s}`)).toBeOnTheScreen()
    );
    ['dev-building-photo', 'dev-building-placeholder', 'dev-floor-ground', 'dev-floor-full', 'dev-room-2', 'dev-room-3'].forEach(
      (id) => expect(screen.getByTestId(id)).toBeOnTheScreen()
    );
  });

  test('reachable from Login in dev builds', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByTestId('dev-components-link'));
    expect(await screen.findByTestId('dev-components-screen')).toBeOnTheScreen();
  });
});
