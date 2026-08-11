'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@repo/ui';
import { adminPath } from '@/lib/admin-path';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const loginUrl = adminPath('/api/login');
      let res = await fetch(loginUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(mfaCode.trim() ? { mfaCode: mfaCode.trim() } : {}),
        }),
      });
      // Local/dev safety: if basePath was baked incorrectly, retry without prefix.
      if (!res.ok && res.status === 404 && loginUrl !== '/api/login') {
        res = await fetch('/api/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
            ...(mfaCode.trim() ? { mfaCode: mfaCode.trim() } : {}),
          }),
        });
      }

      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
      } | null;

      if (!res.ok) {
        if (body?.error?.code === 'MFA_REQUIRED') {
          setNeedsMfa(true);
          setError('Enter your authenticator code.');
        } else {
          setError(body?.error?.message ?? 'Login failed');
        }
        return;
      }

      router.replace(adminPath('/dashboard'));
      router.refresh();
    } catch {
      setError('Unable to sign in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-lg">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MultiBranch</p>
          <CardTitle className="text-2xl">HQ Admin</CardTitle>
          <CardDescription>Sign in with your staff email or username.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email or username
              </label>
              <Input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rajan.chand"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-16"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 my-auto h-8 rounded px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {needsMfa && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="mfa">
                  Authenticator code
                </label>
                <Input
                  id="mfa"
                  name="mfa"
                  inputMode="numeric"
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !email.trim() || !password}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
