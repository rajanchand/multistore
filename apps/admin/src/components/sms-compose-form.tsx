'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function SmsComposeForm({
  branches,
}: {
  branches: Array<{ id: string; name: string; code: string }>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [toPhone, setToPhone] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('marketing_opt_in');
  const [branchId, setBranchId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }

    const payload =
      mode === 'single'
        ? {
            toPhone,
            body,
            campaignId: campaignId || undefined,
            branchId: branchId || undefined,
          }
        : {
            body,
            segment,
            branchId: segment === 'branch_customers' ? branchId : branchId || undefined,
            campaignId: campaignId || undefined,
          };

    try {
      const res = await fetch(`${API_URL}/api/v1/sms/send`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Send failed');
        return;
      }
      setResult(`Queued ${data.queued} message(s)${data.batchId ? ` · batch ${data.batchId}` : ''}`);
      setBody('');
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Mode</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'single' | 'bulk')}
            >
              <option value="single">Individual</option>
              <option value="bulk">Bulk segment</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Campaign id (optional)</span>
            <Input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="UUID" />
          </label>

          {mode === 'single' ? (
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">To phone</span>
              <Input
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                placeholder="+447700900123"
                required
              />
            </label>
          ) : (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Segment</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                >
                  <option value="marketing_opt_in">Marketing opt-in</option>
                  <option value="all_customers">All customers with phone</option>
                  <option value="branch_customers">Branch customers</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Branch</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required={segment === 'branch_customers'}
                >
                  <option value="">Select…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Message</span>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1600}
              required
            />
            <span className="text-xs text-muted-foreground">{body.length}/1600</span>
          </label>

          {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
          {result && <p className="sm:col-span-2 text-sm text-success">{result}</p>}

          <div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Queueing…' : 'Send SMS'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
