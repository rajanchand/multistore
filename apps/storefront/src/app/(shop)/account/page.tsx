'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

const CUSTOMER_SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // match API CUSTOMER session TTL

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Mode = 'login' | 'register';

function persistSession(token: string) {
  document.cookie = `customer_session=${encodeURIComponent(token)}; path=/; Max-Age=${CUSTOMER_SESSION_MAX_AGE_SEC}; SameSite=Lax`;
}

export default function AccountPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('alice@example.dev');
  const [password, setPassword] = useState('DevPassword123!');
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
          headers: (() => {
            const match = document.cookie.match(/(?:^|; )customer_session=([^;]*)/);
            const token = match?.[1] ? decodeURIComponent(match[1]) : null;
            return token ? { Authorization: `Bearer ${token}` } : undefined;
          })(),
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        mode === 'login' ? '/api/v1/customer-auth/login' : '/api/v1/customer-auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : { email, password, firstName: firstName.trim(), lastName: lastName.trim() };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? (mode === 'login' ? 'Sign in failed' : 'Registration failed'));
        return;
      }
      if (!body?.token || !body?.customer) {
        setError('Unexpected response from the API.');
        return;
      }
      persistSession(body.token);
      setCustomer(body.customer);
    } catch {
      setError('Unable to reach the API. Is it running on :4000?');
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/logout', { method: 'POST' });
      document.cookie = 'customer_session=; path=/; Max-Age=0; SameSite=Lax';
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
        <p className="text-sm text-slate-600">Checking your session…</p>
      </div>
    );
  }

  if (customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {customer.firstName}</CardTitle>
            <CardDescription>Signed in as {customer.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/account/orders">Your orders</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/checkout">Continue to checkout</Link>
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
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Sign in' : 'Create account'}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Sign in with your customer email to checkout and view orders.'
              : 'Create a customer account to place orders.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  className="font-medium text-[var(--nm-forest)] underline-offset-2 hover:underline"
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
                  className="font-medium text-[var(--nm-forest)] underline-offset-2 hover:underline"
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
          {mode === 'login' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Dev: alice@example.dev / DevPassword123!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
