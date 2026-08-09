'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STOCK_TRANSFER_TRANSITIONS, type StockTransferStatus } from '@repo/types';
import { Button } from '@repo/ui';
import { API_URL } from '@/lib/api';

const LABELS: Record<string, string> = {
  APPROVED: 'Approve',
  PREPARING: 'Mark preparing',
  IN_TRANSIT: 'Dispatch (in transit)',
  RECEIVED: 'Mark received',
  REJECTED: 'Reject',
  CANCELLED: 'Cancel',
};

export function TransferActions({
  transferId,
  status,
}: {
  transferId: string;
  status: StockTransferStatus;
}) {
  const router = useRouter();
  const next = STOCK_TRANSFER_TRANSITIONS[status] ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (next.length === 0) return null;

  async function transition(to: StockTransferStatus) {
    setBusy(to);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/transfers/${transferId}/transition`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify({ status: to }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? 'Transition failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Unable to reach the API.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {next.map((to) => (
          <Button
            key={to}
            type="button"
            size="sm"
            variant={to === 'REJECTED' || to === 'CANCELLED' ? 'outline' : 'default'}
            disabled={busy != null}
            onClick={() => void transition(to)}
          >
            {busy === to ? '…' : LABELS[to] ?? to}
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
