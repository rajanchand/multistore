import Link from 'next/link';
import { cookies } from 'next/headers';
import { ORDER_SOURCE_LABELS, formatMoney, type OrderSource } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import { getSelectedBranchId, withBranchQuery } from '@/lib/branch-context';

interface OrdersList {
  items: Array<{
    id: string;
    orderNumber: string;
    status: string;
    source: OrderSource;
    total: number;
    placedAt: string;
    branch: { name: string; code: string };
    customer: { firstName: string; lastName: string; email: string };
    payments: Array<{ status: string; provider: string }>;
    _count: { items: number };
  }>;
  total: number;
}

function sourceVariant(source: OrderSource): 'default' | 'secondary' | 'outline' | 'success' | 'warning' {
  if (source === 'ONLINE') return 'default';
  if (source === 'POS') return 'warning';
  return 'success';
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: { source?: string };
}) {
  const token = cookies().get('admin_session')?.value;
  const branchId = getSelectedBranchId();
  const sourceFilter =
    searchParams?.source === 'ONLINE' || searchParams?.source === 'POS' || searchParams?.source === 'CASH'
      ? searchParams.source
      : undefined;

  let path = withBranchQuery('/orders?pageSize=50', branchId);
  if (sourceFilter) {
    path += `${path.includes('?') ? '&' : '?'}source=${sourceFilter}`;
  }

  const data = await api<OrdersList>(path, {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => ({ items: [], total: 0 }));

  const filters: Array<{ label: string; value?: OrderSource }> = [
    { label: 'All' },
    { label: 'Online', value: 'ONLINE' },
    { label: 'POS', value: 'POS' },
    { label: 'Cash', value: 'CASH' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {data.total} orders in scope{branchId ? ' · branch filter on' : ''}
            {sourceFilter ? ` · ${ORDER_SOURCE_LABELS[sourceFilter]}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = sourceFilter === f.value || (!sourceFilter && !f.value);
            const href = f.value ? `/orders?source=${f.value}` : '/orders';
            return (
              <Link
                key={f.label}
                href={href}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Order</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Items</th>
                <th className="pb-2 font-medium">Payment</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-3">
                    <Link className="font-medium text-primary hover:underline" href={`/orders/${o.id}`}>
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="py-3">
                    <Badge variant={sourceVariant(o.source)}>
                      {ORDER_SOURCE_LABELS[o.source] ?? o.source}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {o.customer.firstName} {o.customer.lastName}
                  </td>
                  <td className="py-3">{o.branch.name}</td>
                  <td className="py-3">{new Date(o.placedAt).toLocaleDateString('en-GB')}</td>
                  <td className="py-3">{o._count.items}</td>
                  <td className="py-3">
                    <span className="capitalize">{o.payments[0]?.provider ?? '—'}</span>
                    {o.payments[0]?.status ? (
                      <span className="text-muted-foreground"> · {o.payments[0].status}</span>
                    ) : null}
                  </td>
                  <td className="py-3">{formatMoney(o.total)}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{o.status}</Badge>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No orders found for this filter.
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
