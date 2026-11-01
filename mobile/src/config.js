// EXPO_PUBLIC_API_URL is the backend address without /api, e.g. http://192.168.1.20:3000
// It must be read as process.env.EXPO_PUBLIC_API_URL (literal) so Expo can inline it.
export function getApiBaseUrl() {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) return null;
  return url.trim().replace(/\/+$/, '');
}
