'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

export default function AccountPage() {
  const [email, setEmail] = useState('alice@example.dev');
  const [password, setPassword] = useState('DevPassword123!');
  const [message, setMessage] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch(`${API_URL}/api/v1/customer-auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body?.error?.message ?? 'Login failed');
      return;
    }
    document.cookie = `customer_session=${body.token}; path=/; SameSite=Lax`;
    setMessage(`Signed in as ${body.customer.firstName}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Customer account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={login} className="space-y-4">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
