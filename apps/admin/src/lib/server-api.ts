import { cookies } from 'next/headers';
import { api, ApiError } from './api';

/** Authenticated server-side API helper using the admin session cookie. */
export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = cookies().get('admin_session')?.value;
  if (!token) throw new ApiError('UNAUTHENTICATED', 'Not signed in', 401);
  return api<T>(path, {
    ...init,
    token,
    cache: 'no-store',
    headers: {
      Cookie: `admin_session=${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export { ApiError };
