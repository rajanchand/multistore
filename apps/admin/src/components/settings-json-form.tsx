'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export type SettingsField =
  | { key: string; label: string; type?: 'text' | 'email' | 'url' | 'textarea'; placeholder?: string }
  | { key: string; label: string; type: 'money'; hint?: string }
  | { key: string; label: string; type: 'moneyOptional'; hint?: string };

export function SettingsJsonForm({
  endpoint,
  initial,
  fields,
}: {
  endpoint: string;
  initial: Record<string, unknown>;
  fields: SettingsField[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const raw = initial[field.key];
      if (field.type === 'money' || field.type === 'moneyOptional') {
        next[field.key] =
          raw == null || raw === ''
            ? ''
            : (Number(raw) / 100).toFixed(2);
      } else {
        next[field.key] = raw == null ? '' : String(raw);
      }
    }
    return next;
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }

    const body: Record<string, unknown> = { ...initial };
    for (const field of fields) {
      const v = values[field.key] ?? '';
      if (field.type === 'money') {
        body[field.key] = Math.round(Number(v || 0) * 100);
      } else if (field.type === 'moneyOptional') {
        body[field.key] = v.trim() === '' ? null : Math.round(Number(v) * 100);
      } else {
        body[field.key] = v;
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/v1${endpoint}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to save');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <label
          key={field.key}
          className={`space-y-1.5 text-sm ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}
        >
          <span className="font-medium">{field.label}</span>
          {field.type === 'textarea' ? (
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((s) => ({ ...s, [field.key]: e.target.value }))}
              placeholder={'placeholder' in field ? field.placeholder : undefined}
            />
          ) : (
            <Input
              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((s) => ({ ...s, [field.key]: e.target.value }))}
              placeholder={
                field.type === 'money' || field.type === 'moneyOptional'
                  ? 'e.g. 3.99'
                  : 'placeholder' in field
                    ? field.placeholder
                    : undefined
              }
            />
          )}
          {'hint' in field && field.hint && (
            <span className="text-xs text-muted-foreground">{field.hint}</span>
          )}
        </label>
      ))}
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
        {saved && <p className="text-sm text-emerald-700">Saved</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
