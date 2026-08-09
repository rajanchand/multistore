'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@repo/types';
import { Badge, Button, cn } from '@repo/ui';
import { API_URL, ApiError } from '@/lib/api';

type TerminalSession = {
  sessionId: string;
  orderId: string;
  orderNumber: string;
  branchName: string;
  amount: number;
  currency: string;
  status: 'AWAITING_CARD' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
  failureReason?: string;
};

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function posFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readCookie('admin_session');
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, Cookie: `admin_session=${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      body?.error?.code ?? 'ERROR',
      body?.error?.message ?? res.statusText,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

/** Mock card terminal screen — shows amount and simulate approve/decline for development. */
export function PosTerminalDisplay({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await posFetch<TerminalSession>(`/pos/terminal/${sessionId}`);
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Session not found');
      }
    }
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId]);

  async function act(action: 'approve' | 'decline') {
    setBusy(true);
    setError(null);
    try {
      const data = await posFetch<TerminalSession>(`/pos/terminal/${sessionId}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          action === 'approve'
            ? { cardBrand: 'visa', last4: '4242' }
            : { reason: 'Card declined (simulated)' },
        ),
      });
      setSession(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const awaiting = session?.status === 'AWAITING_CARD';

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div
        className={cn(
          'w-full max-w-sm overflow-hidden rounded-[1.75rem] border-4 border-zinc-800 bg-zinc-950 text-zinc-50 shadow-2xl',
        )}
      >
        <div className="border-b border-zinc-800 px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          POS Terminal · Mock
        </div>
        <div className="space-y-6 px-6 py-10 text-center">
          {error && !session ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : !session ? (
            <p className="text-sm text-zinc-400">Connecting to terminal…</p>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500">{session.branchName}</p>
                <p className="mt-1 text-sm text-zinc-400">{session.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500">Amount due</p>
                <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight">
                  {formatMoney(session.amount, session.currency)}
                </p>
              </div>
              <div className="flex justify-center">
                <Badge
                  variant={
                    session.status === 'APPROVED'
                      ? 'success'
                      : session.status === 'AWAITING_CARD'
                        ? 'warning'
                        : 'destructive'
                  }
                >
                  {session.status.replaceAll('_', ' ')}
                </Badge>
              </div>
              {awaiting && (
                <p className="text-sm text-zinc-400">Present card / tap to pay</p>
              )}
              {session.failureReason && (
                <p className="text-sm text-red-300">{session.failureReason}</p>
              )}
              {session.status === 'APPROVED' && (
                <p className="text-sm text-emerald-300">Payment approved — thank you</p>
              )}
            </>
          )}
        </div>
        {awaiting && (
          <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 bg-zinc-900 px-4 py-4">
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void act('decline')}
            >
              Decline
            </Button>
            <Button type="button" disabled={busy} onClick={() => void act('approve')}>
              Approve
            </Button>
          </div>
        )}
        <p className="px-4 pb-4 text-center text-[10px] text-zinc-600">
          Dev simulation — not connected to Stripe Terminal hardware
        </p>
      </div>
    </div>
  );
}
