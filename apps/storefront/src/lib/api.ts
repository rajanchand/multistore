const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function storeApi<T>(
  path: string,
  options: RequestInit & { cartToken?: string; token?: string } = {},
): Promise<T> {
  const { cartToken, token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(cartToken ? { 'x-cart-token': cartToken } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export { API_URL };
