'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatMoney } from '@repo/types';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import { primaryProductImage } from '@/lib/product-image';

interface CartView {
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
}

export default function CartPage() {
  const { setFromCart } = useCart();
  const [cart, setCart] = useState<CartView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )cart_token=([^;]*)/);
    if (!match?.[1]) {
      setLoaded(true);
      setFromCart({ items: [] });
      return;
    }
    fetch(`${API_URL}/api/v1/carts/current`, {
      headers: { 'x-cart-token': decodeURIComponent(match[1]) },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Cart unavailable');
        return r.json();
      })
      .then((data: CartView) => {
        setCart(data);
        setFromCart(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [setFromCart]);

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-rose-600">{error}</div>;
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-[var(--nm-muted)]">
        Loading cart…
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight text-black">Your cart</h1>
        <p className="mt-4 text-[var(--nm-muted)]">Your cart is empty.</p>
        <Button asChild className="mt-6 h-12 rounded-xl px-6">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  const checkoutBlocked = cart.hasProblems || cart.items.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 nm-animate-in">
      <h1 className="font-display text-4xl font-bold tracking-tight text-black">Your cart</h1>
      <p className="mt-2 text-sm font-medium text-[var(--nm-muted)]">
        {cart.items.reduce((n, i) => n + i.quantity, 0)} items
      </p>
      <div className="mt-8 space-y-6 border-t border-[var(--nm-line)] pt-6">
        {cart.items.map((item) => {
          const thumb = primaryProductImage(item.images);
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 border-b border-[var(--nm-line)] pb-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[var(--nm-line)]">
                  <Image
                    src={thumb}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="min-w-0">
                  {item.slug ? (
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-semibold text-[var(--nm-ink)] hover:underline"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <p className="font-semibold text-[var(--nm-ink)]">{item.name}</p>
                  )}
                  <p className="mt-1 text-sm text-[var(--nm-muted)]">Qty {item.quantity}</p>
                  {item.problems.length > 0 && (
                    <p className="mt-1 text-xs text-rose-600">{item.problems.join(', ')}</p>
                  )}
                </div>
              </div>
              <p className="shrink-0 font-semibold text-[var(--nm-ink)]">
                {formatMoney(item.unitPrice * item.quantity)}
              </p>
            </div>
          );
        })}
        <div className="space-y-2 text-sm text-[var(--nm-muted)]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(cart.totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discounts</span>
            <span>-{formatMoney(cart.totals.discountTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{formatMoney(cart.totals.deliveryFee)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-[var(--nm-ink)]">
            <span>Total (inc. VAT)</span>
            <span>{formatMoney(cart.totals.total)}</span>
          </div>
        </div>
        {checkoutBlocked ? (
          <Button className="h-12 w-full rounded-xl" disabled>
            Checkout unavailable
          </Button>
        ) : (
          <Button asChild className="h-12 w-full rounded-xl">
            <Link href="/checkout">Checkout</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
