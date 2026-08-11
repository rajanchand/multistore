'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';
import { useCart } from '@/lib/cart-context';

const CART_COOKIE = 'cart_token';
const BRANCH_COOKIE = 'preferred_branch';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCartCookie(token: string) {
  document.cookie = `${CART_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
}

function clearCartCookie() {
  document.cookie = `${CART_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function AddToCartButton({
  productId,
  variantId,
  disabled,
  compact = false,
  className = '',
}: {
  productId: string;
  variantId: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { setFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createCart(branchId: string): Promise<string> {
    const res = await fetch(`${API_URL}/api/v1/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? 'Could not create cart');
    writeCartCookie(body.token as string);
    return body.token as string;
  }

  async function ensureCart(branchId: string): Promise<string> {
    const existing = readCookie(CART_COOKIE);
    if (existing) return existing;
    return createCart(branchId);
  }

  async function addItem(token: string, branchId: string) {
    return fetch(`${API_URL}/api/v1/carts/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cart-token': token,
      },
      body: JSON.stringify({ branchId, productId, variantId, quantity: 1 }),
    });
  }

  async function add(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setLoading(true);
    setMessage(null);
    try {
      const branchId = readCookie(BRANCH_COOKIE);
      if (!branchId) throw new Error('Select a store first');
      let token = await ensureCart(branchId);
      let res = await addItem(token, branchId);

      // Stale/checked-out cart — recreate once and retry.
      if (res.status === 404 || res.status === 409) {
        clearCartCookie();
        token = await createCart(branchId);
        res = await addItem(token, branchId);
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not add to cart');
      setFromCart(body);
      setMessage('Added to cart');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <div className={className}>
        <Button
          type="button"
          size="sm"
          className="h-9 w-full rounded-lg text-xs font-semibold"
          onClick={(ev) => void add(ev)}
          disabled={disabled || loading}
        >
          {loading ? 'Adding…' : 'Add to cart'}
        </Button>
        {message && (
          <p className="mt-1 text-[11px] font-medium text-[var(--nm-ink)]" role="status">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-xl font-semibold sm:w-auto sm:min-w-[12rem]"
        onClick={() => void add()}
        disabled={disabled || loading}
      >
        {loading ? 'Adding…' : 'Add to cart'}
      </Button>
      {message && (
        <p className="text-sm font-medium text-[var(--nm-ink)]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
