'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function track(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/v1/track-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, email }),
    });
    const body = await res.json();
    if (!res.ok) {
      setResult(body?.error?.message ?? 'Not found');
      return;
    }
    setResult(`${body.orderNumber}: ${body.status} at ${body.branch.name}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Track order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={track} className="space-y-4">
            <Input
              placeholder="ORD-000001"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="Email used at checkout"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Track
            </Button>
          </form>
          {result && <p className="mt-4 text-sm">{result}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
