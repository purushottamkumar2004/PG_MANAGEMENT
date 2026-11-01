// Builds a fetch mock from a list of [method, path, status, body] routes.
export function mockFetch(routes) {
  const fn = jest.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const path = url.replace('http://test.local:3000', '');
    const match = routes.find(([m, p]) => m === method && p === path);
    if (!match) throw new Error(`Unexpected request ${method} ${path}`);
    const [, , status, body] = match;
    if (status === 'NETWORK') throw new TypeError('Network request failed');
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    };
  });
  global.fetch = fn;
  return fn;
}

export const contractError = (code, message = code) => ({ error: { code, message } });

export const users = {
  admin: { id: 'a1', name: 'Asha Admin', role: 'admin', owner_id: null, building_id: null },
  owner: { id: 'o1', name: 'Ramesh Patil', role: 'owner', owner_id: 'o1', building_id: null },
  manager: { id: 'm1', name: 'Suresh Kale', role: 'manager', owner_id: 'o1', building_id: 'b1' },
};

export async function storeSession(user, token = 'stored-token') {
  const SecureStore = require('expo-secure-store');
  await SecureStore.setItemAsync('pg.session.token', token);
  await SecureStore.setItemAsync('pg.session.user', JSON.stringify(user));
}
