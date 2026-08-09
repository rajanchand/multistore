import Link from 'next/link';
import { cookies } from 'next/headers';
import { api, ApiError } from '@/lib/api';
import { PluginCard } from '@/components/plugin-card';

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

const CATEGORY_ORDER = ['chat', 'social', 'delivery', 'other'];

export default async function SettingsPluginsPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let plugins: Plugin[] = [];
  let error: string | null = null;
  try {
    plugins = await api<Plugin[]>('/plugins?includeDisabled=true', {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load plugins';
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: plugins.filter((p) => p.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / Plugins
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Plugins & delivery partners</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp chat, Facebook, and UK online delivery partners. Enable a plugin and fill non-secret
          config; keep API keys in environment variables.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize">{group.category}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {group.items.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        </section>
      ))}

      {!error && plugins.length === 0 && (
        <p className="text-sm text-muted-foreground">No plugins seeded yet. Run database seed.</p>
      )}
    </div>
  );
}
