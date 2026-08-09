import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { BranchActions } from '@/components/branch-actions';
import { BranchForm } from '@/components/branch-form';

interface BranchDetail {
  id: string;
  name: string;
  code: string;
  slug: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postcode: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  timezone: string;
  currency: string;
  taxRateBps: number;
  deliveryEnabled: boolean;
  clickCollectEnabled: boolean;
  deliveryFee: number;
  freeDeliveryThreshold?: number | null;
  isActive: boolean;
  deletedAt?: string | null;
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  users?: Array<{ user: { id: string; firstName: string; lastName: string; email: string; isActive: boolean } }>;
}

export default async function BranchDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  let branch: BranchDetail;
  try {
    branch = await api<BranchDetail>(`/branches/${params.id}`, {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/branches" className="hover:underline">
              Branches
            </Link>{' '}
            / {branch.code}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{branch.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={branch.isActive ? 'success' : 'secondary'}>
              {branch.isActive ? 'Active' : 'Disabled'}
            </Badge>
            <Badge variant="outline">{branch.code}</Badge>
            <Badge variant="outline">{branch.city}</Badge>
          </div>
        </div>
        <BranchActions id={branch.id} isActive={branch.isActive} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Staff users" value={String(branch.users?.length ?? 0)} />
        <Stat label="Delivery" value={branch.deliveryEnabled ? 'On' : 'Off'} />
        <Stat label="Click & collect" value={branch.clickCollectEnabled ? 'On' : 'Off'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Location & contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Address" value={[branch.addressLine1, branch.addressLine2].filter(Boolean).join(', ')} />
            <Row label="City / postcode" value={`${branch.city}, ${branch.postcode}`} />
            <Row label="Country" value={branch.country} />
            <Row label="Phone" value={branch.phone ?? '—'} />
            <Row label="Email" value={branch.email ?? '—'} />
            <Row
              label="Manager"
              value={
                branch.manager
                  ? `${branch.manager.firstName} ${branch.manager.lastName} (${branch.manager.email})`
                  : '—'
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Commerce settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Timezone" value={branch.timezone} />
            <Row label="Currency" value={branch.currency} />
            <Row label="Tax rate" value={`${(branch.taxRateBps / 100).toFixed(2)}%`} />
            <Row label="Delivery" value={branch.deliveryEnabled ? 'Enabled' : 'Disabled'} />
            <Row label="Click & collect" value={branch.clickCollectEnabled ? 'Enabled' : 'Disabled'} />
            <Row label="Delivery fee" value={formatMoney(branch.deliveryFee, branch.currency)} />
            <Row
              label="Free delivery from"
              value={
                branch.freeDeliveryThreshold == null
                  ? '—'
                  : formatMoney(branch.freeDeliveryThreshold, branch.currency)
              }
            />
            <Row label="Slug" value={branch.slug} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Edit branch</h2>
        <BranchForm
          mode="edit"
          initial={{
            id: branch.id,
            name: branch.name,
            code: branch.code,
            slug: branch.slug,
            addressLine1: branch.addressLine1,
            addressLine2: branch.addressLine2 ?? '',
            city: branch.city,
            postcode: branch.postcode,
            country: branch.country,
            phone: branch.phone ?? '',
            email: branch.email ?? '',
            timezone: branch.timezone,
            currency: branch.currency,
            taxRateBps: branch.taxRateBps,
            deliveryEnabled: branch.deliveryEnabled,
            clickCollectEnabled: branch.clickCollectEnabled,
            deliveryFee: branch.deliveryFee,
            freeDeliveryThreshold: branch.freeDeliveryThreshold,
          }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
