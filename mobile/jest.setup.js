// Tests talk to a fake backend; no real network.
process.env.EXPO_PUBLIC_API_URL = 'http://test.local:3000';

// In-memory secure store so session persistence can be tested.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

beforeEach(() => {
  require('expo-secure-store').__store.clear();
  global.fetch = jest.fn(() => Promise.reject(new Error('fetch not mocked in this test')));
});
