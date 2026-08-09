import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { SettingsJsonForm } from '@/components/settings-json-form';

export default async function SettingsStorePage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let store: Record<string, unknown> = {};
  let error: string | null = null;
  try {
    store = await api<Record<string, unknown>>('/settings/store', {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load store details';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / Store details
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Store details</h1>
        <p className="text-sm text-muted-foreground">
          Global brand and legal details shown across admin and storefront
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identity & contact</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsJsonForm
            endpoint="/settings/store"
            initial={store}
            fields={[
              { key: 'storeName', label: 'Store name' },
              { key: 'legalName', label: 'Legal name' },
              { key: 'tagline', label: 'Tagline' },
              { key: 'supportEmail', label: 'Support email', type: 'email' },
              { key: 'supportPhone', label: 'Support phone' },
              { key: 'website', label: 'Website', type: 'url', placeholder: 'https://' },
              { key: 'logoUrl', label: 'Logo URL', type: 'url', placeholder: 'https://' },
              { key: 'addressLine1', label: 'Address line 1' },
              { key: 'addressLine2', label: 'Address line 2' },
              { key: 'city', label: 'City' },
              { key: 'postcode', label: 'Postcode' },
              { key: 'country', label: 'Country (ISO)' },
              { key: 'timezone', label: 'Timezone' },
              { key: 'currency', label: 'Currency' },
              { key: 'vatNumber', label: 'VAT number' },
              { key: 'companyNumber', label: 'Company number' },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
