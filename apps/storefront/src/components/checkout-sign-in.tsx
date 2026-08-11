'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { loginCustomerSession } from '@/lib/customer-session-client';
import { DEMO_CUSTOMER } from '@/lib/demo-customer';

export function CheckoutSignIn() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useDemoAccount() {
    setLoading(true);
    setError(null);
    const result = await loginCustomerSession(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    if ('error' in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">
        Checkout
      </h1>
      <Card className="mt-8 border-[var(--nm-line)] bg-[var(--nm-surface)]">
        <CardHeader>
          <CardTitle>Sign in required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[var(--nm-muted)]">
          <p>
            Checkout creates a server-side order, reserves stock atomically, and opens a Stripe
            PaymentIntent. Sign in as a customer before payment.
          </p>
          <div className="rounded-xl border border-dashed border-[var(--nm-line)] bg-[var(--nm-soft)]/60 px-4 py-3">
            <p className="font-medium text-[var(--nm-ink)]">Demo shopper account</p>
            <p className="mt-1">
              Email <span className="font-mono text-[var(--nm-ink)]">{DEMO_CUSTOMER.email}</span>
              {' · '}
              password{' '}
              <span className="font-mono text-[var(--nm-ink)]">{DEMO_CUSTOMER.password}</span>
            </p>
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="rounded-xl"
              disabled={loading}
              onClick={() => void useDemoAccount()}
            >
              {loading ? 'Signing in…' : 'Continue with demo account'}
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/account?next=/checkout">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/cart">Back to cart</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
