'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';
import { useCart } from '@/lib/cart-context';
import { addCartItemViaProxy, createCartViaProxy } from '@/lib/cart-api';
import { clearCartToken, readCartToken, writeCartToken } from '@/lib/cart-cookie';
import { getPreferredBranchCookie } from '@/lib/branch-cookie';

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
    const body = await createCartViaProxy(branchId);
    writeCartToken(body.token);
    return body.token;
  }

  async function ensureCart(branchId: string): Promise<string> {
    const existing = readCartToken();
    if (existing) return existing;
    return createCart(branchId);
  }

  async function add(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setLoading(true);
    setMessage(null);
    try {
      const branchId = getPreferredBranchCookie();
      if (!branchId) throw new Error('Select a store first');
      let token = await ensureCart(branchId);
      let res = await addCartItemViaProxy({ token, branchId, productId, variantId });

      // Stale/checked-out cart — recreate once and retry.
      if (res.status === 404 || res.status === 409 || res.status === 410) {
        clearCartToken();
        token = await createCart(branchId);
        res = await addCartItemViaProxy({ token, branchId, productId, variantId });
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
