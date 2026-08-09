import { API_URL } from '@/lib/api';

/**
 * Browser → API fetch using the API-domain httpOnly session cookie.
 * Do not read session tokens from document.cookie (XSS-stealable).
 */
export async function clientApi(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
}
