'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

export interface BranchFormValues {
  id?: string;
  name: string;
  code: string;
  slug: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
  timezone: string;
  currency: string;
  taxRateBps: number;
  deliveryEnabled: boolean;
  clickCollectEnabled: boolean;
  deliveryFee: number;
  freeDeliveryThreshold?: number | null;
}

const defaults: BranchFormValues = {
  name: '',
  code: '',
  slug: '',
  addressLine1: '',
  city: '',
  postcode: '',
  country: 'GB',
  timezone: 'Europe/London',
  currency: 'GBP',
  taxRateBps: 2000,
  deliveryEnabled: true,
  clickCollectEnabled: true,
  deliveryFee: 399,
};

export function BranchForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<BranchFormValues>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BranchFormValues>({ ...defaults, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && mode === 'create' && (!prev.slug || prev.slug === slugify(prev.name))) {
        next.slug = slugify(String(value));
      }
      if (key === 'name' && mode === 'create' && (!prev.code || prev.code.length < 2)) {
        next.code = String(value)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 3);
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name,
      code: form.code.toUpperCase(),
      slug: form.slug,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2 || undefined,
      city: form.city,
      postcode: form.postcode,
      country: form.country || 'GB',
      phone: form.phone || undefined,
      email: form.email || undefined,
      timezone: form.timezone,
      currency: form.currency,
      taxRateBps: Number(form.taxRateBps),
      deliveryEnabled: form.deliveryEnabled,
      clickCollectEnabled: form.clickCollectEnabled,
      deliveryFee: Number(form.deliveryFee),
      freeDeliveryThreshold:
        form.freeDeliveryThreshold == null || form.freeDeliveryThreshold === ('' as never)
          ? null
          : Number(form.freeDeliveryThreshold),
    };

    try {
      const res = await fetch(
        `${API_URL}/api/v1/branches${mode === 'edit' ? `/${form.id}` : ''}`,
        {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'Request failed');
        return;
      }
      router.push(`/branches/${body.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Code">
            <Input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              required
              maxLength={12}
            />
          </Field>
          <Field label="Slug">
            <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} required />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} required />
          </Field>
          <Field label="Address line 1" className="sm:col-span-2">
            <Input
              value={form.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
              required
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input
              value={form.addressLine2 ?? ''}
              onChange={(e) => set('addressLine2', e.target.value)}
            />
          </Field>
          <Field label="Postcode">
            <Input value={form.postcode} onChange={(e) => set('postcode', e.target.value)} required />
          </Field>
          <Field label="Country (ISO)">
            <Input value={form.country} onChange={(e) => set('country', e.target.value)} required />
          </Field>
          <Field label="Phone">
            <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Timezone">
            <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field label="Currency">
            <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} />
          </Field>
          <Field label="Tax rate (basis points, 2000 = 20%)">
            <Input
              type="number"
              value={form.taxRateBps}
              onChange={(e) => set('taxRateBps', Number(e.target.value))}
            />
          </Field>
          <Field label="Delivery fee (pence)">
            <Input
              type="number"
              value={form.deliveryFee}
              onChange={(e) => set('deliveryFee', Number(e.target.value))}
            />
          </Field>
          <Field label="Free delivery threshold (pence)">
            <Input
              type="number"
              value={form.freeDeliveryThreshold ?? ''}
              onChange={(e) =>
                set('freeDeliveryThreshold', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.deliveryEnabled}
              onChange={(e) => set('deliveryEnabled', e.target.checked)}
            />
            Delivery enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.clickCollectEnabled}
              onChange={(e) => set('clickCollectEnabled', e.target.checked)}
            />
            Click & collect enabled
          </label>

          {error && (
            <p className="sm:col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="sm:col-span-2 flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : mode === 'create' ? 'Create branch' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/branches')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 text-sm ${className ?? ''}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
