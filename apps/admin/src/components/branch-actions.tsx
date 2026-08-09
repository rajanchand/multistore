'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function BranchActions({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'enable' | 'disable' | 'archive') {
    setBusy(action);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setBusy(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/branches/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? 'Action failed');
        return;
      }
      if (action === 'archive') {
        router.push('/branches');
      }
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {isActive ? (
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run('disable')}>
            {busy === 'disable' ? 'Disabling…' : 'Disable'}
          </Button>
        ) : (
          <Button size="sm" disabled={!!busy} onClick={() => run('enable')}>
            {busy === 'enable' ? 'Enabling…' : 'Enable'}
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          disabled={!!busy}
          onClick={() => {
            if (confirm('Archive this branch? It will be hidden from the list.')) {
              void run('archive');
            }
          }}
        >
          {busy === 'archive' ? 'Archiving…' : 'Archive'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
