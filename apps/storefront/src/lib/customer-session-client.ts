import { API_URL } from '@/lib/api';

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

/** Log in via the API and establish the storefront session cookie. */
export async function loginCustomerSession(
  email: string,
  password: string,
): Promise<{ customer: Customer } | { error: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/customer-auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => null)) as {
      customer?: Customer;
      token?: string;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      return { error: body?.error?.message ?? 'Sign in failed' };
    }
    if (!body?.customer) {
      return { error: 'Unexpected response from the API.' };
    }
    if (body.token) {
      const sessionRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: body.token }),
      });
      if (!sessionRes.ok) {
        return { error: 'Signed in, but failed to establish a local session cookie.' };
      }
    }
    return { customer: body.customer };
  } catch {
    return { error: 'Unable to reach the API. Is it running on :4000?' };
  }
}
