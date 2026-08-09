import { cookies } from 'next/headers';
import { api } from './api';

export interface AdminMe {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  isGlobal: boolean;
  mfaEnabled: boolean;
  permissions: string[];
  branchIds: string[];
}

export async function getAdminSession(): Promise<AdminMe | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) return null;
  try {
    return await api<AdminMe>('/auth/me', {
      token,
      cache: 'no-store',
      headers: { Cookie: `admin_session=${token}` },
    });
  } catch {
    return null;
  }
}

export function hasPermission(user: AdminMe | null, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}
