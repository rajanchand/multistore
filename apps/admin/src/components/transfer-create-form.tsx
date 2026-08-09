'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { API_URL } from '@/lib/api';

export type TransferBranchOption = { id: string; name: string; code: string };

export type TransferProductOption = {
  id: string;
  name: string;
  variants: Array<{ id: string; name: string; sku: string }>;
};

type Line = {
  productId: string;
  variantId: string;
  quantity: number;
};

export function TransferCreateForm({
  branches,
  products,
}: {
  branches: TransferBranchOption[];
  products: TransferProductOption[];
}) {
  const router = useRouter();
  const nonHq = useMemo(() => branches.filter((b) => b.code !== 'HQ'), [branches]);
  const [fromBranchId, setFromBranchId] = useState(nonHq[0]?.id ?? '');
  const [toBranchId, setToBranchId] = useState(nonHq[1]?.id ?? nonHq[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([
    {
      productId: products[0]?.id ?? '',
      variantId: products[0]?.variants[0]?.id ?? '',
      quantity: 1,
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = products.find((p) => p.id === patch.productId);
          next.variantId = product?.variants[0]?.id ?? '';
        }
        return next;
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/transfers`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify({
          fromBranchId,
          toBranchId,
          notes: notes.trim() || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || undefined,
            quantity: l.quantity,
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to create transfer');
        return;
      }
      router.push('/inventory/transfers');
      router.refresh();
    } catch {
      setError('Unable to reach the API.');
    } finally {
      setSaving(false);
    }
  }

  if (nonHq.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Need at least two non-HQ branches to create a stock transfer.
      </p>
    );
  }

  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">No products available to transfer.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">From branch</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={fromBranchId}
            onChange={(e) => setFromBranchId(e.target.value)}
            required
          >
            {nonHq.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">To branch</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={toBranchId}
            onChange={(e) => setToBranchId(e.target.value)}
            required
          >
            {nonHq.map((b) => (
              <option key={b.id} value={b.id} disabled={b.id === fromBranchId}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Notes (optional)</span>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Lines</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const first = products[0];
              if (!first) return;
              setLines((prev) => [
                ...prev,
                {
                  productId: first.id,
                  variantId: first.variants[0]?.id ?? '',
                  quantity: 1,
                },
              ]);
            }}
          >
            Add line
          </Button>
        </div>
        {lines.map((line, index) => {
          const product = products.find((p) => p.id === line.productId);
          return (
            <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
              <label className="block space-y-1 text-sm sm:col-span-5">
                <span className="text-muted-foreground">Product</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={line.productId}
                  onChange={(e) => updateLine(index, { productId: e.target.value })}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm sm:col-span-4">
                <span className="text-muted-foreground">Variant</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={line.variantId}
                  onChange={(e) => updateLine(index, { variantId: e.target.value })}
                >
                  {(product?.variants ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.sku})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Qty</span>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </label>
              <div className="flex items-end sm:col-span-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lines.length === 1}
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="submit" disabled={saving || fromBranchId === toBranchId}>
        {saving ? 'Creating…' : 'Request transfer'}
      </Button>
    </form>
  );
}
