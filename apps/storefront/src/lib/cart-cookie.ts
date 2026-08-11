const CART_COOKIE = 'cart_token';

export function readCartToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function writeCartToken(token: string) {
  document.cookie = `${CART_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
}

export function clearCartToken() {
  document.cookie = `${CART_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export { CART_COOKIE };
