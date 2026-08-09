'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function CatalogueEntityActions({
  kind,
  id,
  isVisible,
}: {
  kind: 'categories' | 'brands';
  id: string;
  isVisible: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/${kind}/${id}/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? 'Action failed');
        return;
      }
      if (path === 'archive') {
        router.push(`/${kind}`);
      }
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isVisible ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void call('hide')}>
            Hide
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void call('show')}>
            Unhide
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          onClick={() => void call('archive', 'Archive this item? It will be removed from the storefront.')}
        >
          Delete
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
