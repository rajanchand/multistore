import Link from 'next/link';
import { cookies } from 'next/headers';
import type { StockTransferStatus } from '@repo/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { TransferActions } from '@/components/transfer-actions';

type TransferRow = {
  id: string;
  number: string;
  status: StockTransferStatus;
  notes: string | null;
  createdAt: string;
  fromBranch: { id: string; name: string; code: string };
  toBranch: { id: string; name: string; code: string };
  createdBy: { firstName: string; lastName: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    variant: { id: string; name: string; sku: string };
  }>;
};

function statusVariant(status: StockTransferStatus): 'secondary' | 'success' | 'warning' | 'destructive' {
  if (status === 'RECEIVED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive';
  if (status === 'IN_TRANSIT' || status === 'PREPARING') return 'warning';
  return 'secondary';
}

export default async function InventoryTransfersPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let transfers: TransferRow[] = [];
  let error: string | null = null;
  try {
    const data = await api<{ items: TransferRow[] }>('/inventory/transfers?pageSize=50', {
      token,
      cache: 'no-store',
      headers,
    });
    transfers = data.items;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load transfers';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/inventory" className="hover:underline">
              Inventory
            </Link>{' '}
            / Transfers
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Stock transfers</h1>
          <p className="text-sm text-muted-foreground">
            Request transfers between branches; stock leaves at IN_TRANSIT and arrives at RECEIVED
          </p>
        </div>
        <Button asChild>
          <Link href="/inventory/transfers/new">New transfer</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transfers ({transfers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          {transfers.length === 0 && !error && (
            <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet</p>
          )}
          {transfers.map((t) => (
            <div key={t.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.number}</p>
                    <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.fromBranch.name} → {t.toBranch.name}
                    {t.createdBy
                      ? ` · ${t.createdBy.firstName} ${t.createdBy.lastName}`
                      : ''}
                  </p>
                  <ul className="mt-2 text-sm text-muted-foreground">
                    {t.items.map((item) => (
                      <li key={item.id}>
                        {item.variant.name} ({item.variant.sku}) × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  {t.notes && <p className="mt-2 text-xs text-muted-foreground">{t.notes}</p>}
                </div>
                <TransferActions transferId={t.id} status={t.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
