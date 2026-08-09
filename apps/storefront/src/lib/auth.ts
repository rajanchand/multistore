import { cookies } from 'next/headers';
import { storeApi } from './api';

export interface CustomerMe {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string;
}

export async function getCustomerSession(): Promise<CustomerMe | null> {
  const token = cookies().get('customer_session')?.value;
  if (!token) return null;
  try {
    return await storeApi<CustomerMe>('/customer-auth/me', {
      token,
      cache: 'no-store',
      headers: { Cookie: `customer_session=${token}` },
    });
  } catch {
    return null;
  }
}
