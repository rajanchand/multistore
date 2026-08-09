import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { SettingsJsonForm } from '@/components/settings-json-form';

export default async function SettingsSocialPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let social: Record<string, unknown> = {};
  let error: string | null = null;
  try {
    social = await api<Record<string, unknown>>('/settings/social', {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load social links';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / Social accounts
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Social account links</h1>
        <p className="text-sm text-muted-foreground">
          Public profile URLs shown in the storefront footer
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsJsonForm
            endpoint="/settings/social"
            initial={social}
            fields={[
              { key: 'facebook', label: 'Facebook', type: 'url', placeholder: 'https://www.facebook.com/…' },
              { key: 'instagram', label: 'Instagram', type: 'url', placeholder: 'https://www.instagram.com/…' },
              { key: 'x', label: 'X (Twitter)', type: 'url', placeholder: 'https://x.com/…' },
              { key: 'tiktok', label: 'TikTok', type: 'url', placeholder: 'https://www.tiktok.com/@…' },
              { key: 'youtube', label: 'YouTube', type: 'url', placeholder: 'https://www.youtube.com/…' },
              { key: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'https://www.linkedin.com/…' },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
