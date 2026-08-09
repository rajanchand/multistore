'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { API_URL } from '@/lib/api';

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

export function PluginCard({ plugin }: { plugin: Plugin }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(plugin.isEnabled);
  const [configText, setConfigText] = useState(
    JSON.stringify(plugin.config ?? {}, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(nextEnabled?: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      setError('Config must be valid JSON');
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/plugins/${plugin.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: nextEnabled ?? enabled,
          config,
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
            {plugin.category} · {plugin.provider} · <span className="font-mono">{plugin.code}</span>
          </p>
        </div>
        <Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {plugin.description && (
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
        )}
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Config (non-secret JSON)</span>
          <textarea
            className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            Save config
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save(!enabled)}
          >
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {message && <p className="text-xs text-emerald-700">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {plugin.category === 'delivery' && (
          <p className="text-xs text-muted-foreground">
            Partner API secrets belong in environment variables — never paste keys into config.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
