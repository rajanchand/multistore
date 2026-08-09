'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, parseMoney, percentOf } from '@repo/types';
import { Button, Card, CardContent, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';
import { ProductImageEditor } from '@/components/product-image-editor';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

/** Format pence as a plain decimal string for inputs (e.g. 149 → "1.49"). */
function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

function tryParsePence(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseMoney(trimmed);
  } catch {
    return null;
  }
}

function discountPercentFromPrices(original: number, sale: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - sale) / original) * 1000) / 10;
}

export function ProductForm({
  mode,
  initial,
  branches = [],
}: {
  mode: 'create' | 'edit';
  initial?: {
    id?: string;
    name?: string;
    sku?: string;
    barcode?: string | null;
    slug?: string;
    brand?: string;
    shortDescription?: string;
    status?: string;
    defaultPrice?: number;
    images?: string[];
  };
  branches?: Array<{ id: string; name: string; code: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [barcode, setBarcode] = useState(initial?.barcode ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'ACTIVE');
  const [images, setImages] = useState<string[]>(
    Array.isArray(initial?.images) ? initial.images : [],
  );
  const [originalPrice, setOriginalPrice] = useState(
    penceToInput(initial?.defaultPrice ?? 149),
  );
  const [discountPrice, setDiscountPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    branches.length === 1 ? [branches[0]!.id] : [],
  );
  const [initialStock, setInitialStock] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onOriginalPriceChange(value: string) {
    setOriginalPrice(value);
    const original = tryParsePence(value);
    const pct = Number(discountPercent);
    if (original != null && discountPercent.trim() !== '' && Number.isFinite(pct) && pct > 0) {
      const sale = original - percentOf(original, pct);
      setDiscountPrice(sale > 0 && sale < original ? penceToInput(sale) : '');
    }
  }

  function onDiscountPercentChange(value: string) {
    setDiscountPercent(value);
    const original = tryParsePence(originalPrice);
    const pct = Number(value);
    if (original == null || value.trim() === '' || !Number.isFinite(pct)) {
      if (value.trim() === '') setDiscountPrice('');
      return;
    }
    if (pct <= 0 || pct >= 100) {
      setDiscountPrice('');
      return;
    }
    const sale = original - percentOf(original, pct);
    setDiscountPrice(sale > 0 && sale < original ? penceToInput(sale) : '');
  }

  function onDiscountPriceChange(value: string) {
    setDiscountPrice(value);
    const original = tryParsePence(originalPrice);
    const sale = tryParsePence(value);
    if (original == null || sale == null || value.trim() === '') {
      if (value.trim() === '') setDiscountPercent('');
      return;
    }
    if (sale >= original || sale < 0) {
      setDiscountPercent('');
      return;
    }
    setDiscountPercent(String(discountPercentFromPrices(original, sale)));
  }

  function toggleBranch(id: string) {
    setSelectedBranchIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const token = readCookie('admin_session');
    if (!token) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const barcodeValue = barcode.trim() === '' ? null : barcode.trim();

    let payload: Record<string, unknown>;
    if (mode === 'create') {
      const originalPence = tryParsePence(originalPrice);
      if (originalPence == null || originalPence <= 0) {
        setError('Enter a valid original price (e.g. 1.49).');
        setLoading(false);
        return;
      }

      let salePence: number | null = null;
      if (discountPrice.trim()) {
        salePence = tryParsePence(discountPrice);
        if (salePence == null) {
          setError('Enter a valid discount price (e.g. 1.34).');
          setLoading(false);
          return;
        }
        if (salePence >= originalPence) {
          setError('Discount price must be lower than original price.');
          setLoading(false);
          return;
        }
      }

      const stock = Number(initialStock);
      if (
        selectedBranchIds.length > 0 &&
        (initialStock.trim() === '' || !Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock))
      ) {
        setError('Enter a whole-number opening stock (0 or more) for the selected stores.');
        setLoading(false);
        return;
      }

      payload = {
        name,
        sku,
        barcode: barcodeValue,
        slug: slug || slugify(name),
        brand: brand || undefined,
        shortDescription: shortDescription || undefined,
        status,
        images,
        salePrice: salePence,
        branchIds: selectedBranchIds,
        ...(selectedBranchIds.length > 0 ? { initialStock: stock } : {}),
        variants: [
          {
            sku: `${sku}-DEFAULT`,
            barcode: barcodeValue,
            name: 'Default',
            defaultPrice: originalPence,
            attributes: {},
            images: images.slice(0, 1),
          },
        ],
      };
    } else {
      payload = {
        name,
        sku,
        barcode: barcodeValue,
        slug,
        brand: brand || undefined,
        shortDescription: shortDescription || undefined,
        status,
        images,
      };
    }

    try {
      const res = await fetch(
        `${API_URL}/api/v1/products${mode === 'edit' ? `/${initial?.id}` : ''}`,
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
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'Request failed');
        return;
      }
      router.push(`/products/${body.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the API.');
    } finally {
      setLoading(false);
    }
  }

  const originalPencePreview = tryParsePence(originalPrice);
  const salePencePreview = tryParsePence(discountPrice);

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Name</span>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (mode === 'create' && (!slug || slug === slugify(name))) {
                  setSlug(slugify(e.target.value));
                }
              }}
              required
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">SKU</span>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} required />
            <span className="text-xs text-muted-foreground">Used for POS lookup and inventory</span>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Barcode</span>
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. 5060166690034"
              inputMode="numeric"
              autoComplete="off"
            />
            <span className="text-xs text-muted-foreground">
              Scan or type GTIN — POS matches this barcode at the till
            </span>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Slug</span>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Brand</span>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Status</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>

          {mode === 'create' && (
            <>
              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Original price (£)</span>
                  <Input
                    inputMode="decimal"
                    placeholder="1.49"
                    value={originalPrice}
                    onChange={(e) => onOriginalPriceChange(e.target.value)}
                    required
                  />
                  <span className="text-xs text-muted-foreground">
                    {originalPencePreview != null
                      ? `${formatMoney(originalPencePreview)} · ${originalPencePreview}p`
                      : 'List / selling price'}
                  </span>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">% discount</span>
                  <Input
                    inputMode="decimal"
                    placeholder="10"
                    value={discountPercent}
                    onChange={(e) => onDiscountPercentChange(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">Optional · updates discount price</span>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Discount price (£)</span>
                  <Input
                    inputMode="decimal"
                    placeholder="1.34"
                    value={discountPrice}
                    onChange={(e) => onDiscountPriceChange(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {salePencePreview != null
                      ? `${formatMoney(salePencePreview)} · must be below original`
                      : 'Optional sale price'}
                  </span>
                </label>
              </div>

              {branches.length > 0 && (
                <fieldset className="sm:col-span-2 space-y-2">
                  <legend className="text-sm font-medium">Save to stores</legend>
                  <p className="text-xs text-muted-foreground">
                    Select branches to create pricing and stock. POS only finds products assigned to
                    the till&apos;s branch.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {branches.map((b) => {
                      const checked = selectedBranchIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={checked}
                            onChange={() => toggleBranch(b.id)}
                          />
                          <span>
                            {b.name}{' '}
                            <span className="font-mono text-xs text-muted-foreground">({b.code})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedBranchIds.length > 0 && (
                    <label className="mt-2 block max-w-xs space-y-1.5 text-sm">
                      <span className="font-medium">Opening stock (per store)</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={initialStock}
                        onChange={(e) => setInitialStock(e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">
                        Applied to each selected branch so the item can sell on POS immediately
                      </span>
                    </label>
                  )}
                </fieldset>
              )}
            </>
          )}

          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Short description</span>
            <Input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </label>

          <ProductImageEditor images={images} onChange={setImages} />

          {error && (
            <p className="sm:col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="sm:col-span-2 flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/products')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
