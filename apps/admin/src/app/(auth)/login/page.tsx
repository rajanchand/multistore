'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('superadmin@dev.local');
  const [password, setPassword] = useState('DevPassword123!');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.error?.code === 'MFA_REQUIRED') {
          setNeedsMfa(true);
          setError('Enter your authenticator code.');
        } else {
          setError(body?.error?.message ?? 'Login failed');
        }
        return;
      }
      // Persist token for server components that forward Authorization.
      document.cookie = `admin_session=${body.token}; path=/; SameSite=Lax`;
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to reach the API. Is it running on :4000?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100 px-4">
      <Card className="w-full max-w-md border-slate-200 shadow-lg">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MultiBranch</p>
          <CardTitle className="text-2xl">HQ Admin</CardTitle>
          <CardDescription>Sign in with your staff account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {needsMfa && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="mfa">
                  Authenticator code
                </label>
                <Input
                  id="mfa"
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                />
              </div>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Dev: superadmin@dev.local / DevPassword123!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
