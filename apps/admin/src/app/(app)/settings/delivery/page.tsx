import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { SettingsJsonForm } from '@/components/settings-json-form';

export default async function SettingsDeliveryPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let delivery: Record<string, unknown> = {};
  let branches: Array<{
    id: string;
    name: string;
    code: string;
    deliveryFee: number;
    freeDeliveryThreshold: number | null;
    deliveryEnabled: boolean;
  }> = [];
  let error: string | null = null;

  try {
    [delivery, branches] = await Promise.all([
      api<Record<string, unknown>>('/settings/delivery', { token, cache: 'no-store', headers }),
      api<typeof branches>('/branches', { token, cache: 'no-store', headers }).catch(() => []),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load delivery settings';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>{' '}
          / Delivery charges
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Delivery charge details</h1>
        <p className="text-sm text-muted-foreground">
          Platform defaults plus a live view of each branch fee. Per-branch overrides stay on Branches.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Default charges</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsJsonForm
            endpoint="/settings/delivery"
            initial={delivery}
            fields={[
              {
                key: 'defaultDeliveryFee',
                label: 'Default delivery fee (£)',
                type: 'money',
                hint: 'Used as guidance / new-branch default (pence stored server-side)',
              },
              {
                key: 'defaultFreeDeliveryThreshold',
                label: 'Free delivery from (£)',
                type: 'moneyOptional',
                hint: 'Leave blank for no free-delivery threshold',
              },
              {
                key: 'minOrderForDelivery',
                label: 'Minimum order for delivery (£)',
                type: 'moneyOptional',
              },
              {
                key: 'estimatedDeliveryHours',
                label: 'Estimated delivery window',
                placeholder: '2–4 hours',
              },
              {
                key: 'deliveryNotes',
                label: 'Customer-facing notes',
                type: 'textarea',
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch fees</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Delivery</th>
                <th className="pb-2 font-medium">Fee</th>
                <th className="pb-2 font-medium">Free from</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-3">
                    <p className="font-medium">{b.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{b.code}</p>
                  </td>
                  <td className="py-3">{b.deliveryEnabled ? 'On' : 'Off'}</td>
                  <td className="py-3">£{(b.deliveryFee / 100).toFixed(2)}</td>
                  <td className="py-3">
                    {b.freeDeliveryThreshold != null
                      ? `£${(b.freeDeliveryThreshold / 100).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <Link href={`/branches/${b.id}`} className="text-sm underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No branches found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
