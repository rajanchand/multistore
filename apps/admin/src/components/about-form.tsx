'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function AboutForm({
  initial,
}: {
  initial?: { sectionKey: string; title: string; body: string; sortOrder: number };
}) {
  const router = useRouter();
  const [sectionKey, setSectionKey] = useState(initial?.sectionKey ?? 'company');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/about`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sectionKey,
          title,
          body,
          sortOrder: Number(sortOrder) || 0,
          isPublished: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to save');
        return;
      }
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Section key</span>
        <Input value={sectionKey} onChange={(e) => setSectionKey(e.target.value)} required />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Sort order</span>
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </label>
      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Body</span>
        <textarea
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
      </label>
      {error && <p className="md:col-span-2 text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save section'}
        </Button>
      </div>
    </form>
  );
}
