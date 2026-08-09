'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const BANNER_TYPES = [
  'HERO',
  'MOBILE_HERO',
  'CATEGORY',
  'PROMOTION',
  'POPUP',
  'ANNOUNCEMENT',
] as const;

const BANNER_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

export type BannerBranchOption = { id: string; name: string; code: string };

export type BannerFormInitial = {
  id?: string;
  title: string;
  type: (typeof BANNER_TYPES)[number];
  status: (typeof BANNER_STATUSES)[number];
  image?: string | null;
  mobileImage?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  body?: string | null;
  priority?: number;
  startsAt: string;
  endsAt?: string | null;
  isGlobal: boolean;
  branches?: Array<{ branch: BannerBranchOption }>;
  branchIds?: string[];
};

function toLocalInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Image must be 2MB or smaller'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export function BannerForm({
  mode,
  branches,
  initial,
}: {
  mode: 'create' | 'edit';
  branches: BannerBranchOption[];
  initial?: BannerFormInitial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<(typeof BANNER_TYPES)[number]>(initial?.type ?? 'HERO');
  const [status, setStatus] = useState<(typeof BANNER_STATUSES)[number]>(
    initial?.status ?? 'DRAFT',
  );
  const [image, setImage] = useState(initial?.image ?? '');
  const [mobileImage, setMobileImage] = useState(initial?.mobileImage ?? '');
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? '');
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? '/products');
  const [body, setBody] = useState(initial?.body ?? '');
  const [priority, setPriority] = useState(String(initial?.priority ?? 100));
  const [startsAt, setStartsAt] = useState(
    toLocalInputValue(initial?.startsAt) || toLocalInputValue(new Date()),
  );
  const [endsAt, setEndsAt] = useState(toLocalInputValue(initial?.endsAt));
  const [isGlobal, setIsGlobal] = useState(initial?.isGlobal ?? true);
  const [branchIds, setBranchIds] = useState<string[]>(
    initial?.branchIds ?? initial?.branches?.map((b) => b.branch.id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scopeLabel = useMemo(() => {
    if (isGlobal) return 'All branches';
    if (branchIds.length === 0) return 'No branches selected';
    return branches
      .filter((b) => branchIds.includes(b.id))
      .map((b) => b.code)
      .join(', ');
  }, [isGlobal, branchIds, branches]);

  function toggleBranch(id: string) {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }

    const payload = {
      title,
      type,
      status,
      image: image || null,
      mobileImage: mobileImage || null,
      ctaLabel: ctaLabel || '',
      ctaUrl: ctaUrl || '',
      body: body || '',
      priority: Number(priority) || 100,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      isGlobal,
      branchIds: isGlobal ? [] : branchIds,
    };

    try {
      const res = await fetch(
        `${API_URL}/api/v1/banners${mode === 'edit' ? `/${initial?.id}` : ''}`,
        {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to save banner');
        return;
      }
      router.push(mode === 'edit' ? `/banners/${data.id}` : '/banners');
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Type</span>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as (typeof BANNER_TYPES)[number])}
        >
          {BANNER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Status</span>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof BANNER_STATUSES)[number])}
        >
          {BANNER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Desktop / main image</span>
        <Input
          value={image.startsWith('data:') ? '' : image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://… or upload below"
        />
        <input
          type="file"
          accept="image/*"
          className="mt-2 block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (!file) return;
            void fileToDataUrl(file)
              .then(setImage)
              .catch((err: Error) => setError(err.message));
          }}
        />
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt="Banner preview"
            className="mt-2 max-h-40 rounded-md border object-cover"
          />
        )}
      </label>

      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Mobile image (optional)</span>
        <Input
          value={mobileImage.startsWith('data:') ? '' : mobileImage}
          onChange={(e) => setMobileImage(e.target.value)}
          placeholder="https://… or upload below"
        />
        <input
          type="file"
          accept="image/*"
          className="mt-2 block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (!file) return;
            void fileToDataUrl(file)
              .then(setMobileImage)
              .catch((err: Error) => setError(err.message));
          }}
        />
        {mobileImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mobileImage}
            alt="Mobile banner preview"
            className="mt-2 max-h-40 rounded-md border object-cover"
          />
        )}
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="font-medium">CTA label</span>
        <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Shop now" />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">CTA URL (relative)</span>
        <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/products" />
      </label>

      <label className="space-y-1.5 text-sm md:col-span-2">
        <span className="font-medium">Body / supporting text</span>
        <textarea
          className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Starts at</span>
        <Input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Ends at (optional)</span>
        <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Priority (lower = earlier)</span>
        <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
      </label>

      <fieldset className="space-y-2 md:col-span-2">
        <legend className="text-sm font-medium">Branch visibility</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
          />
          Show on all branches
        </label>
        {!isGlobal && (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />
                {b.name} ({b.code})
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Scope: {scopeLabel}</p>
      </fieldset>

      {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}

      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : mode === 'edit' ? 'Save banner' : 'Add banner'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/banners')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
