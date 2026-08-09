'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

type Plugin = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  provider: string;
  isEnabled: boolean;
  config?: Record<string, unknown> | null;
};

const HIDDEN_KEYS = new Set(['docsUrl', 'envVars', 'setupSteps', 'webhookPath']);

function isEditableKey(key: string, value: unknown): boolean {
  if (HIDDEN_KEYS.has(key)) return false;
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  );
}

export function AppIntegrationCard({ plugin }: { plugin: Plugin }) {
  const router = useRouter();
  const config = useMemo(
    () => (plugin.config && typeof plugin.config === 'object' ? { ...plugin.config } : {}),
    [plugin.config],
  );
  const [enabled, setEnabled] = useState(plugin.isEnabled);
  const [fields, setFields] = useState<Record<string, string | boolean>>(() => {
    const next: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(config)) {
      if (!isEditableKey(key, value)) continue;
      if (typeof value === 'boolean') next[key] = value;
      else next[key] = value == null ? '' : String(value);
    }
    return next;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const docsUrl = typeof config.docsUrl === 'string' ? config.docsUrl : null;
  const envVars = Array.isArray(config.envVars) ? (config.envVars as string[]) : [];
  const setupSteps = Array.isArray(config.setupSteps) ? (config.setupSteps as string[]) : [];
  const webhookPath = typeof config.webhookPath === 'string' ? config.webhookPath : null;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  async function save(nextEnabled?: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setBusy(false);
      return;
    }

    const nextConfig: Record<string, unknown> = { ...config };
    for (const [key, value] of Object.entries(fields)) {
      nextConfig[key] = value;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/plugins/${plugin.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isEnabled: nextEnabled ?? enabled,
          config: nextConfig,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Update failed');
        return;
      }
      if (typeof nextEnabled === 'boolean') setEnabled(nextEnabled);
      setMessage('Saved');
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{plugin.name}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {plugin.provider} · <span className="font-mono">{plugin.code}</span>
          </p>
        </div>
        <Badge variant={enabled ? 'success' : 'secondary'}>
          {enabled ? 'Connected' : 'Not connected'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {plugin.description && (
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
        )}

        {setupSteps.length > 0 && (
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-sm font-medium">Easy integration steps</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              {setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {envVars.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">API secrets (environment only)</p>
            <p className="mt-1 font-mono">{envVars.join(', ')}</p>
            <p className="mt-1">Never paste API keys into this form — set them in `.env` and restart the API.</p>
          </div>
        )}

        {webhookPath && (
          <div className="text-xs">
            <p className="font-medium">Webhook URL</p>
            <p className="mt-1 break-all font-mono text-muted-foreground">
              {apiBase}
              {webhookPath}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(fields).map(([key, value]) =>
            typeof value === 'boolean' ? (
              <label key={key} className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setFields((s) => ({ ...s, [key]: e.target.checked }))}
                />
                {key === 'sandbox' ? 'Sandbox / test mode' : key}
              </label>
            ) : (
              <label key={key} className="space-y-1.5 text-sm">
                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <Input
                  value={value}
                  onChange={(e) => setFields((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder={key}
                />
              </label>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            Save settings
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save(!enabled)}
          >
            {enabled ? 'Disconnect' : 'Connect / Enable'}
          </Button>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              Partner docs
            </a>
          )}
        </div>
        {message && <p className="text-xs text-emerald-700">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
