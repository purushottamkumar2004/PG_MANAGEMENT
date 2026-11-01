import { getApiBaseUrl } from '../config';

const TIMEOUT_MS = 15000;

// One readable error type for every failure. `code` matches docs/API_CONTRACT.md
// error codes, plus two app-side codes: NETWORK_ERROR and CONFIG_ERROR.
export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

let getToken = () => null;
let onUnauthorized = () => {};

// Called once by the SessionProvider so the client can read the token and
// clear the session (back to Login) when the server answers 401.
export function configureClient(options = {}) {
  if (options.getToken) getToken = options.getToken;
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

const STATUS_FALLBACK_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

async function readJson(response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new ApiError('CONFIG_ERROR', 'EXPO_PUBLIC_API_URL is not set');

  const token = auth ? getToken() : null;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', err && err.message ? err.message : 'Network request failed');
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await readJson(response);

  if (response.ok) return data;

  const contractError = data && data.error;
  const code =
    (contractError && typeof contractError.code === 'string' && contractError.code) ||
    STATUS_FALLBACK_CODES[response.status] ||
    'INTERNAL';
  const message = (contractError && contractError.message) || `HTTP ${response.status}`;

  // A 401 on an authenticated call means the stored token is no longer good.
  // (A 401 from /auth/login is just a wrong password and must not log anyone out.)
  if (response.status === 401 && token) onUnauthorized();

  throw new ApiError(code, message, response.status);
}

export const authApi = {
  login: (phone, password) =>
    request('/api/auth/login', { method: 'POST', body: { phone, password }, auth: false }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
};
