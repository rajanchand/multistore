'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';
import { loginCustomerSession } from '@/lib/customer-session-client';
import { DEMO_CUSTOMER } from '@/lib/demo-customer';

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Mode = 'login' | 'register';

export default function AccountClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/checkout';
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const res = await fetch(`${API_URL}/api/v1/customer-auth/me`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = (await res.json()) as Customer;
        if (!cancelled) setCustomer(body);
      } catch {
        /* offline / API down — keep signed-out UI */
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function afterSignIn(signedIn: Customer) {
    setCustomer(signedIn);
    if (nextPath.startsWith('/') && !nextPath.startsWith('//')) {
      router.push(nextPath);
      router.refresh();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const result = await loginCustomerSession(email, password);
        if ('error' in result) {
          setError(result.error);
          return;
        }
        afterSignIn(result.customer);
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/customer-auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'Registration failed');
        return;
      }
      if (!body?.customer) {
        setError('Unexpected response from the API.');
        return;
      }
      if (body?.token) {
        const sessionRes = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: body.token }),
        });
        if (!sessionRes.ok) {
          setError('Signed in, but failed to establish a local session cookie.');
          return;
        }
      }
      afterSignIn(body.customer as Customer);
    } catch {
      setError('Unable to reach the API. Is it running on :4000?');
    } finally {
      setLoading(false);
    }
  }

  async function useDemoAccount() {
    setLoading(true);
    setError(null);
    setMode('login');
    setEmail(DEMO_CUSTOMER.email);
    setPassword(DEMO_CUSTOMER.password);
    const result = await loginCustomerSession(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    if ('error' in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    afterSignIn(result.customer);
    setLoading(false);
  }

  async function onLogout() {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/logout', { method: 'POST' });
      setCustomer(null);
      setMode('login');
    } catch {
      setError('Sign out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-[var(--nm-muted)]">Checking your session…</p>
      </div>
    );
  }

  if (customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-display mb-6 text-3xl font-bold tracking-tight text-[var(--nm-ink)]">
          Account
        </h1>
        <Card className="border-[var(--nm-line)] shadow-none">
          <CardHeader>
            <CardTitle>Welcome, {customer.firstName}</CardTitle>
            <CardDescription>Signed in as {customer.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/checkout">Continue to checkout</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/account/orders">Your orders</Link>
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => void onLogout()}
            >
              {loading ? 'Signing out…' : 'Sign out'}
            </Button>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display mb-6 text-3xl font-bold tracking-tight text-[var(--nm-ink)]">
        Account
      </h1>
      <Card className="border-[var(--nm-line)] shadow-none">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Sign in' : 'Create account'}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Sign in with your customer email to checkout and view orders.'
              : 'Create a customer account to place orders.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' && (
            <div className="mb-5 space-y-3 rounded-xl border border-dashed border-[var(--nm-line)] bg-[var(--nm-soft)]/60 px-4 py-3">
              <p className="text-sm font-medium text-[var(--nm-ink)]">Demo shopper for checkout</p>
              <p className="text-xs text-[var(--nm-muted)]">
                {DEMO_CUSTOMER.email} · {DEMO_CUSTOMER.password}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => void useDemoAccount()}
              >
                {loading ? 'Signing in…' : 'Continue with demo account'}
              </Button>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="firstName">
                    First name
                  </label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="lastName">
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 10 : 1}
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            {mode === 'login' ? (
              <>
                New here?{' '}
                <button
                  type="button"
                  className="font-medium text-[var(--nm-accent)] underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="font-medium text-[var(--nm-accent)] underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
