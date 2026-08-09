'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export interface CatalogueEntityValues {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  allBranches?: boolean;
  branchIds?: string[];
}

export function CatalogueEntityForm({
  kind,
  mode,
  initial,
  branches,
}: {
  kind: 'categories' | 'brands';
  mode: 'create' | 'edit';
  initial?: CatalogueEntityValues;
  branches: BranchOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [image, setImage] = useState(initial?.image ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [allBranches, setAllBranches] = useState(initial?.allBranches ?? true);
  const [branchIds, setBranchIds] = useState<string[]>(initial?.branchIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const label = kind === 'categories' ? 'Category' : 'Brand';

  const selectedSummary = useMemo(() => {
    if (allBranches) return 'All branches';
    if (branchIds.length === 0) return 'No branches selected';
    return branches
      .filter((b) => branchIds.includes(b.id))
      .map((b) => b.code)
      .join(', ');
  }, [allBranches, branchIds, branches]);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

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
    if (!allBranches && branchIds.length === 0) {
      setError('Select at least one branch, or enable All branches');
      setLoading(false);
      return;
    }

    const payload = {
      name,
      slug: slug || toSlug(name),
      description: description || undefined,
      image: image || null,
      sortOrder: Number(sortOrder) || 0,
      isVisible,
      allBranches,
      branchIds: allBranches ? [] : branchIds,
    };

    try {
      const res = await fetch(
        `${API_URL}/api/v1/${kind}${mode === 'edit' ? `/${initial?.id}` : ''}`,
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
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? `Failed to save ${label.toLowerCase()}`);
        return;
      }
      router.push(`/${kind}/${body.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Name</span>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} required />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Slug</span>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
        </label>
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-medium">Description</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Sort order</span>
          <Input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
          Visible on storefront
        </label>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm font-medium">Image</p>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-28 w-28 rounded-md object-cover border" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="https://… or upload"
            value={image.startsWith('data:') ? '' : image}
            onChange={(e) => setImage(e.target.value)}
          />
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {image && (
            <Button type="button" variant="outline" onClick={() => setImage('')}>
              Remove image
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Branch visibility</p>
            <p className="text-xs text-muted-foreground">{selectedSummary}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allBranches}
              onChange={(e) => setAllBranches(e.target.checked)}
            />
            All branches
          </label>
        </div>
        {!allBranches && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />
                <span>
                  {b.name} <span className="text-muted-foreground">({b.code})</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : mode === 'create' ? `Create ${label}` : `Save ${label}`}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/${kind}`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
