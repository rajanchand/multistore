import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { AppIntegrationCard } from '@/components/app-integration-card';

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

export default async function AppsPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let apps: Plugin[] = [];
  let error: string | null = null;
  try {
    apps = await api<Plugin[]>('/plugins?includeDisabled=true&category=marketplace', {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load apps';
  }

  const connected = apps.filter((a) => a.isEnabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Apps</h1>
        <p className="text-sm text-muted-foreground">
          Partner with online delivery marketplaces — Uber Eats, Deliveroo, Just Eat, Uber Direct, and more
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How integrations work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Each app uses the same simple pattern: put API secrets in environment variables, fill
            non-secret store IDs here, register the webhook URL with the partner, then connect.
          </p>
          <p>
            Parcel couriers (DPD, Evri, Royal Mail…) stay under{' '}
            <Link href="/settings/plugins" className="underline">
              Settings → Plugins
            </Link>
            . This page is for marketplace / on-demand delivery apps.
          </p>
          <p>
            Connected: {connected}/{apps.length}
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {apps.map((app) => (
          <AppIntegrationCard key={app.id} plugin={app} />
        ))}
      </div>

      {!error && apps.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No marketplace apps found. Run <code className="rounded bg-muted px-1">pnpm db:seed</code>{' '}
          to install Uber Eats, Deliveroo, Just Eat, Uber Direct, DoorDash Drive, and Getir.
        </p>
      )}
    </div>
  );
}
