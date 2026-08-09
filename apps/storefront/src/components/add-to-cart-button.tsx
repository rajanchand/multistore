'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';

const CART_COOKIE = 'cart_token';
const BRANCH_COOKIE = 'preferred_branch';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function AddToCartButton({
  productId,
  variantId,
  disabled,
}: {
  productId: string;
  variantId: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function ensureCart(branchId: string): Promise<string> {
    const existing = readCookie(CART_COOKIE);
    if (existing) return existing;
    const res = await fetch(`${API_URL}/api/v1/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? 'Could not create cart');
    document.cookie = `${CART_COOKIE}=${body.token}; path=/; max-age=2592000; SameSite=Lax`;
    return body.token as string;
  }

  async function add() {
    setLoading(true);
    setMessage(null);
    try {
      const branchId = readCookie(BRANCH_COOKIE);
      if (!branchId) throw new Error('Select a branch first');
      const token = await ensureCart(branchId);
      const res = await fetch(`${API_URL}/api/v1/carts/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cart-token': token,
        },
        body: JSON.stringify({ branchId, productId, variantId, quantity: 1 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not add to cart');
      setMessage('Added to cart');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="h-12 w-full rounded-xl sm:w-auto sm:min-w-[12rem]"
        onClick={add}
        disabled={disabled || loading}
      >
        {loading ? 'Adding…' : 'Add to cart'}
      </Button>
      {message && <p className="text-sm text-[var(--nm-muted)]">{message}</p>}
    </div>
  );
}
