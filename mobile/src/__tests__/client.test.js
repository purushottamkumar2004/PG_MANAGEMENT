import { ApiError, authApi, configureClient, request } from '../api/client';
import { contractError, mockFetch, users } from './helpers';

describe('api client', () => {
  let token;
  let onUnauthorized;

  beforeEach(() => {
    token = null;
    onUnauthorized = jest.fn();
    configureClient({ getToken: () => token, onUnauthorized });
  });

  test('uses EXPO_PUBLIC_API_URL and sends JSON body for login, without a token', async () => {
    token = 'should-not-be-sent';
    const fetch = mockFetch([['POST', '/api/auth/login', 200, { token: 't', user: users.owner }]]);
    const res = await authApi.login('9000000001', 'owner123');
    expect(res.user.role).toBe('owner');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://test.local:3000/api/auth/login');
    expect(JSON.parse(options.body)).toEqual({ phone: '9000000001', password: 'owner123' });
    expect(options.headers.Authorization).toBeUndefined();
  });

  test('adds the Bearer token on authenticated calls', async () => {
    token = 'abc';
    const fetch = mockFetch([['GET', '/api/auth/me', 200, { user: users.manager }]]);
    await authApi.me();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  test('turns the contract error shape into ApiError', async () => {
    mockFetch([['POST', '/api/auth/login', 403, contractError('ACCOUNT_INACTIVE', 'Owner is switched off')]]);
    const err = await authApi.login('9000000001', 'x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('ACCOUNT_INACTIVE');
    expect(err.status).toBe(403);
    expect(err.message).toBe('Owner is switched off');
  });

  test('401 on login (wrong password) does NOT clear the session', async () => {
    mockFetch([['POST', '/api/auth/login', 401, contractError('INVALID_CREDENTIALS')]]);
    const err = await authApi.login('9000000001', 'bad').catch((e) => e);
    expect(err.code).toBe('INVALID_CREDENTIALS');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('401 on an authenticated call clears the session', async () => {
    token = 'expired';
    mockFetch([['GET', '/api/auth/me', 401, contractError('UNAUTHORIZED')]]);
    const err = await authApi.me().catch((e) => e);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('network failure becomes NETWORK_ERROR', async () => {
    mockFetch([['GET', '/api/health', 'NETWORK']]);
    const err = await request('/api/health', { auth: false }).catch((e) => e);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  test('non-JSON error body falls back to a code from the HTTP status', async () => {
    mockFetch([
      ['GET', '/api/a', 404, '<html>not found</html>'],
      ['GET', '/api/b', 502, 'Bad gateway'],
    ]);
    expect((await request('/api/a').catch((e) => e)).code).toBe('NOT_FOUND');
    expect((await request('/api/b').catch((e) => e)).code).toBe('INTERNAL');
  });

  test('missing EXPO_PUBLIC_API_URL gives CONFIG_ERROR', async () => {
    const saved = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    try {
      const err = await request('/api/health').catch((e) => e);
      expect(err.code).toBe('CONFIG_ERROR');
    } finally {
      process.env.EXPO_PUBLIC_API_URL = saved;
    }
  });

  test('trailing slash in base URL is ignored', async () => {
    const saved = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'http://test.local:3000/';
    try {
      const fetch = mockFetch([['GET', '/api/health', 200, { ok: true }]]);
      await request('/api/health', { auth: false });
      expect(fetch.mock.calls[0][0]).toBe('http://test.local:3000/api/health');
    } finally {
      process.env.EXPO_PUBLIC_API_URL = saved;
    }
  });
});
