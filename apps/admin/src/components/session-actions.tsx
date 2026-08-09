'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';

export function SessionActions({
  sessionId,
  isCurrent,
}: {
  sessionId?: string;
  isCurrent?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke(path: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/sessions${path}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Revoke failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void revoke('/others')}>
          {busy ? '…' : 'Revoke other sessions'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || isCurrent}
        onClick={() => void revoke(`/${sessionId}`)}
      >
        {isCurrent ? 'Current' : busy ? '…' : 'Revoke'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
