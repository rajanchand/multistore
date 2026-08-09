'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function BannerActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') {
    setBusy(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setBusy(false);
      return;
    }
    try {
      const path =
        next === 'ARCHIVED'
          ? `${API_URL}/api/v1/banners/${id}/archive`
          : `${API_URL}/api/v1/banners/${id}`;
      const res = await fetch(path, {
        method: next === 'ARCHIVED' ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: next === 'ARCHIVED' ? undefined : JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Update failed');
        return;
      }
      if (next === 'ARCHIVED') router.push('/banners');
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'ACTIVE' && (
        <Button size="sm" disabled={busy} onClick={() => void setStatus('ACTIVE')}>
          Activate
        </Button>
      )}
      {status === 'ACTIVE' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus('DRAFT')}>
          Set draft
        </Button>
      )}
      {status !== 'ARCHIVED' && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (confirm('Archive this banner?')) void setStatus('ARCHIVED');
          }}
        >
          Archive
        </Button>
      )}
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
