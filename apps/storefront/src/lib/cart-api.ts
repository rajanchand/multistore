import { clearCartToken, readCartToken } from '@/lib/cart-cookie';

export type CartApiView = {
  id: string;
  items: Array<{
    id: string;
    name: string;
    slug?: string;
    quantity: number;
    unitPrice: number;
    images?: string[];
    problems: string[];
  }>;
  totals: {
    subtotal: number;
    discountTotal: number;
    deliveryFee: number;
    taxTotal: number;
    total: number;
  };
  hasProblems: boolean;
  branch?: {
    id: string;
    name: string;
    deliveryEnabled: boolean;
    clickCollectEnabled: boolean;
    deliveryFee: number;
  };
};

/** Same-origin cart endpoints (Next proxies to the API). */
const CART_BASE = '/api/cart';

/**
 * Load the current cart. Stale/checked-out tokens (404/409/410) clear the cookie
 * and resolve to null so the UI can show an empty cart instead of "unavailable".
 */
export async function fetchCurrentCart(): Promise<{
  cart: CartApiView | null;
  stale: boolean;
  error: string | null;
}> {
  const token = readCartToken();
  if (!token) {
    return { cart: null, stale: false, error: null };
  }

  try {
    const res = await fetch(`${CART_BASE}/current`, {
      headers: { 'x-cart-token': token },
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (res.status === 404 || res.status === 409 || res.status === 410) {
      clearCartToken();
      return { cart: null, stale: true, error: null };
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return {
        cart: null,
        stale: false,
        error: body?.error?.message ?? 'Could not load your cart. Please try again.',
      };
    }

    const cart = (await res.json()) as CartApiView;
    return { cart, stale: false, error: null };
  } catch {
    return {
      cart: null,
      stale: false,
      error: 'Could not reach the cart service. Check your connection and try again.',
    };
  }
}

export async function createCartViaProxy(branchId: string): Promise<{ token: string; cart: unknown }> {
  const res = await fetch(CART_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ branchId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Could not create cart');
  return body as { token: string; cart: unknown };
}

export async function addCartItemViaProxy(input: {
  token: string;
  branchId: string;
  productId: string;
  variantId: string;
  quantity?: number;
}) {
  return fetch(`${CART_BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cart-token': input.token,
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      branchId: input.branchId,
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity ?? 1,
    }),
  });
}

export async function switchCartBranchViaProxy(token: string, branchId: string) {
  return fetch(`${CART_BASE}/branch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cart-token': token,
    },
    credentials: 'same-origin',
    body: JSON.stringify({ branchId }),
  });
}
