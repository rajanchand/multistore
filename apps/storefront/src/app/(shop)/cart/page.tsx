'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@repo/types';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { API_URL } from '@/lib/api';

interface CartView {
  id: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
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
  const [cart, setCart] = useState<CartView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )cart_token=([^;]*)/);
    if (!match?.[1]) return;
    fetch(`${API_URL}/api/v1/carts/current`, {
      headers: { 'x-cart-token': decodeURIComponent(match[1]) },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Cart unavailable');
        return r.json();
      })
      .then(setCart)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-rose-600">{error}</div>;
  }
  if (!cart) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-[Fraunces] text-4xl font-semibold">Your cart</h1>
        <p className="mt-4 text-slate-600">Your cart is empty.</p>
        <Button asChild className="mt-6">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-[Fraunces] text-4xl font-semibold">Your cart</h1>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between border-b pb-4 last:border-0">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">Qty {item.quantity}</p>
                {item.problems.length > 0 && (
                  <p className="text-xs text-rose-600">{item.problems.join(', ')}</p>
                )}
              </div>
              <p className="font-medium">{formatMoney(item.unitPrice * item.quantity)}</p>
            </div>
          ))}
          <div className="space-y-1 text-sm">
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
            <div className="flex justify-between font-semibold">
              <span>Total (inc. VAT)</span>
              <span>{formatMoney(cart.totals.total)}</span>
            </div>
          </div>
          <Button asChild className="w-full" disabled={cart.hasProblems || cart.items.length === 0}>
            <Link href="/checkout">Checkout</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
