'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const ACTIONS = [
  { value: 'ADD_PRODUCT', label: 'Add product to branches' },
  { value: 'PUBLISH', label: 'Publish (visible)' },
  { value: 'HIDE', label: 'Hide' },
  { value: 'ARCHIVE', label: 'Archive', destructive: true },
  { value: 'CHANGE_PRICE', label: 'Change price' },
  { value: 'SET_SALE_PRICE', label: 'Set sale price' },
  { value: 'PERCENTAGE_ADJUSTMENT', label: 'Percentage price adjust' },
  { value: 'CHANGE_AVAILABILITY', label: 'Change availability' },
  { value: 'CHANGE_CATEGORY', label: 'Change category' },
  { value: 'APPLY_PROMOTION', label: 'Apply promotion' },
  { value: 'REMOVE_PROMOTION', label: 'Remove promotion', destructive: true },
] as const;

type Branch = { id: string; name: string; code: string };
type Product = { id: string; name: string; sku: string };
type Category = { id: string; name: string };
type Promotion = { id: string; name: string };

export function BulkOperationForm({
  branches,
  products,
  categories,
  promotions,
}: {
  branches: Branch[];
  products: Product[];
  categories: Category[];
  promotions: Promotion[];
}) {
  const router = useRouter();
  const [action, setAction] = useState<string>('PUBLISH');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [sellingPrice, setSellingPrice] = useState('9.99');
  const [salePrice, setSalePrice] = useState('');
  const [percent, setPercent] = useState('5');
  const [isAvailable, setIsAvailable] = useState(true);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [promotionId, setPromotionId] = useState(promotions[0]?.id ?? '');
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<{
    productCount: number;
    branchCount: number;
    affectedRecords: number;
    warning?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const meta = useMemo(() => ACTIONS.find((a) => a.value === action), [action]);

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function buildBody() {
    const payload: Record<string, unknown> = {};
    if (action === 'CHANGE_PRICE') {
      payload.sellingPrice = Math.round(Number(sellingPrice || 0) * 100);
    }
    if (action === 'SET_SALE_PRICE') {
      payload.salePrice = salePrice.trim() === '' ? null : Math.round(Number(salePrice) * 100);
    }
    if (action === 'PERCENTAGE_ADJUSTMENT') {
      payload.percentBps = Math.round(Number(percent || 0) * 100);
    }
    if (action === 'CHANGE_AVAILABILITY') payload.isAvailable = isAvailable;
    if (action === 'CHANGE_CATEGORY') payload.categoryId = categoryId;
    if (action === 'APPLY_PROMOTION' || action === 'REMOVE_PROMOTION') {
      payload.promotionId = promotionId;
    }
    if (meta && 'destructive' in meta && meta.destructive) payload.confirm = confirm;

    return {
      action,
      branchIds,
      productIds,
      categoryIds,
      payload,
    };
  }

  async function run(kind: 'preview' | 'start') {
    setLoading(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/api/v1/bulk-operations${kind === 'preview' ? '/preview' : ''}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildBody()),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Request failed');
        return;
      }
      if (kind === 'preview') {
        setPreview(data);
      } else {
        router.push(`/bulk-operations/${data.id}`);
        router.refresh();
      }
    } catch {
      setError('Unable to reach the API');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Action</span>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPreview(null);
            setConfirm(false);
          }}
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Branches</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={branchIds.includes(b.id)}
                onChange={() => toggle(branchIds, b.id, setBranchIds)}
              />
              {b.name} ({b.code})
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Products (optional if using categories)</legend>
        <div className="max-h-48 overflow-y-auto rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productIds.includes(p.id)}
                  onChange={() => toggle(productIds, p.id, setProductIds)}
                />
                <span>
                  {p.name} <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Or select by category</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={categoryIds.includes(c.id)}
                onChange={() => toggle(categoryIds, c.id, setCategoryIds)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      {action === 'CHANGE_PRICE' && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">New selling price (£)</span>
          <Input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
        </label>
      )}
      {action === 'SET_SALE_PRICE' && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Sale price (£) — leave blank to clear</span>
          <Input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
        </label>
      )}
      {action === 'PERCENTAGE_ADJUSTMENT' && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Adjust by %</span>
          <Input value={percent} onChange={(e) => setPercent(e.target.value)} />
        </label>
      )}
      {action === 'CHANGE_AVAILABILITY' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
          />
          Mark as available
        </label>
      )}
      {action === 'CHANGE_CATEGORY' && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {(action === 'APPLY_PROMOTION' || action === 'REMOVE_PROMOTION') && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Promotion</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={promotionId}
            onChange={(e) => setPromotionId(e.target.value)}
          >
            {promotions.length === 0 && <option value="">No promotions</option>}
            {promotions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {meta && 'destructive' in meta && meta.destructive && (
        <label className="flex items-center gap-2 text-sm text-destructive">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          I confirm this destructive action
        </label>
      )}

      {preview && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Preview: {preview.productCount} products × {preview.branchCount} branches ={' '}
          {preview.affectedRecords} records
          {preview.warning ? ` — ${preview.warning}` : ''}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={loading} onClick={() => void run('preview')}>
          Preview
        </Button>
        <Button type="button" disabled={loading} onClick={() => void run('start')}>
          {loading ? 'Working…' : 'Start job'}
        </Button>
      </div>
    </div>
  );
}
