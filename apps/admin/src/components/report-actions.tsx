'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

type ReportKind = 'summary' | 'sales' | 'orders' | 'inventory';

type Recipient = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  branches: Array<{ id: string; name: string; code: string }>;
};

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function ReportActions({
  kind,
  range = '30d',
  branchId = null,
}: {
  kind: ReportKind;
  range?: string;
  branchId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [extraEmails, setExtraEmails] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (kind !== 'inventory') params.set('range', range);
    if (branchId) params.set('branchIds', branchId);
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [kind, range, branchId]);

  useEffect(() => {
    if (!open) return;
    const token = readCookie('admin_session');
    fetch(`${API_URL}/api/v1/reports/recipients`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load staff list');
        return res.json() as Promise<Recipient[]>;
      })
      .then((items) => {
        setRecipients(items);
        const managers = Object.fromEntries(
          items
            .filter((r) => r.roles.includes('BRANCH_MANAGER') || r.roles.includes('ADMIN'))
            .map((r) => [r.id, true]),
        );
        setSelected(managers);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load recipients'));
  }, [open]);

  async function downloadPdf() {
    setDownloading(true);
    setError(null);
    setMessage(null);
    try {
      const token = readCookie('admin_session');
      const res = await fetch(`${API_URL}/api/v1/reports/${kind}/pdf${query}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'PDF download failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? `${kind}-report.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('PDF downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function sendReport() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const userIds = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const emails = extraEmails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (userIds.length === 0 && emails.length === 0) {
      setError('Select staff or enter at least one email.');
      setLoading(false);
      return;
    }
    try {
      const token = readCookie('admin_session');
      const res = await fetch(`${API_URL}/api/v1/reports/${kind}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          range: kind === 'inventory' ? undefined : range,
          branchIds: branchId ? [branchId] : undefined,
          userIds,
          emails,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Send failed');
      }
      setMessage(`Sent to ${data.sent} recipient(s) via ${data.provider}.`);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={downloadPdf} disabled={downloading}>
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
        <Button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close send' : 'Send to managers'}
        </Button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {open && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-medium">Staff & managers</p>
            <p className="text-xs text-muted-foreground">
              Select people to email this report in one click. Managers are pre-selected.
            </p>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {recipients.length === 0 && (
                <p className="text-sm text-muted-foreground">Loading staff…</p>
              )}
              {recipients.map((r) => (
                <label key={r.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selected[r.id])}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="font-medium">{r.name}</span>{' '}
                    <span className="text-muted-foreground">{r.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.roles.join(', ')}
                      {r.branches.length
                        ? ` · ${r.branches.map((b) => b.code).join(', ')}`
                        : ' · HQ'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Extra emails</span>
            <Input
              value={extraEmails}
              onChange={(e) => setExtraEmails(e.target.value)}
              placeholder="manager@example.com, ops@example.com"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Note (optional)</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Short message included in the email body"
            />
          </label>

          <Button type="button" onClick={sendReport} disabled={loading}>
            {loading ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      )}
    </div>
  );
}
