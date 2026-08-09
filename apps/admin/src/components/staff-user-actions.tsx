'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

async function apiAction(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: data?.error?.message ?? 'Request failed' };
    return { ok: true };
  } catch {
    return { ok: false, message: 'Unable to reach the API' };
  }
}

export function StaffUserActions({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    const result = await fn();
    setBusy(null);
    if (!result.ok) {
      setError(result.message ?? 'Failed');
      return;
    }
    setMessage('Done');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy}
          onClick={() =>
            void run('status', () =>
              apiAction(`/users/${userId}`, 'PATCH', { isActive: !isActive }),
            )
          }
        >
          {busy === 'status' ? '…' : isActive ? 'Disable user' : 'Enable user'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy}
          onClick={() =>
            void run('sessions', () => apiAction(`/users/${userId}/revoke-sessions`, 'POST'))
          }
        >
          {busy === 'sessions' ? '…' : 'Revoke sessions'}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!!busy}
          onClick={() => {
            if (!confirm('Delete this staff user? This cannot be undone.')) return;
            void run('delete', async () => {
              const result = await apiAction(`/users/${userId}`, 'DELETE');
              if (result.ok) {
                router.push('/users');
                router.refresh();
              }
              return result;
            });
          }}
        >
          {busy === 'delete' ? '…' : 'Delete user'}
        </Button>
      </div>

      <div className="rounded-md border p-4">
        <p className="mb-2 text-sm font-medium">Reset password</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="password"
            placeholder="New password (min 10 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sm:max-w-sm"
          />
          <Button
            size="sm"
            disabled={!!busy || password.length < 10}
            onClick={() =>
              void run('reset', async () => {
                const result = await apiAction(`/users/${userId}/reset-password`, 'POST', {
                  password,
                });
                if (result.ok) setPassword('');
                return result;
              })
            }
          >
            {busy === 'reset' ? '…' : 'Reset password'}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Resets the password and signs the user out of all sessions.
        </p>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
