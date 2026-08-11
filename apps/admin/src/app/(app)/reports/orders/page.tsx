import Link from 'next/link';
import { cookies } from 'next/headers';
import { ORDER_SOURCE_LABELS, formatMoney, type OrderSource } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { getSelectedBranchId, withBranchQuery } from '@/lib/branch-context';
import { ReportActions } from '@/components/report-actions';

export default async function OrdersReportPage() {
  const token = cookies().get('admin_session')?.value;
  const branchId = getSelectedBranchId();
  let data: {
    byStatus: Array<{ status: string; count: number; total: number }>;
    byFulfilment: Array<{ type: string; count: number }>;
    bySource: Array<{ source: OrderSource; count: number; total: number }>;
    recent: Array<{
      id: string;
      orderNumber: string;
      status: string;
      source: OrderSource;
      total: number;
      placedAt: string;
      branch: { name: string; code: string };
      customer: { firstName: string; lastName: string; email: string };
    }>;
  } | null = null;
  let error: string | null = null;

  try {
    data = await api(withBranchQuery('/reports/orders?range=30d', branchId), {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load orders report';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/reports" className="hover:underline">
            Reports
          </Link>{' '}
          / Orders
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Orders report</h1>
        <div className="mt-4">
          <ReportActions kind="orders" range="30d" branchId={branchId} />
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>By status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between border-b py-2 last:border-0">
                    <span>
                      <Badge variant="secondary">{s.status}</Badge> ×{s.count}
                    </span>
                    <span>{formatMoney(s.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.bySource.map((s) => (
                  <div key={s.source} className="flex justify-between border-b py-2 last:border-0">
                    <span>
                      <Badge
                        variant={
                          s.source === 'ONLINE'
                            ? 'default'
                            : s.source === 'POS'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {ORDER_SOURCE_LABELS[s.source] ?? s.source}
                      </Badge>{' '}
                      ×{s.count}
                    </span>
                    <span>{formatMoney(s.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By fulfilment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.byFulfilment.map((f) => (
                  <div key={f.type} className="flex justify-between border-b py-2 last:border-0">
                    <span>{f.type}</span>
                    <span>{f.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
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
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link className="text-primary hover:underline" href={`/orders/${o.id}`}>
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={
                            o.source === 'ONLINE'
                              ? 'default'
                              : o.source === 'POS'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {ORDER_SOURCE_LABELS[o.source] ?? o.source}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {o.customer.firstName} {o.customer.lastName}
                      </td>
                      <td className="py-2">{o.branch.code}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{o.status}</Badge>
                      </td>
                      <td className="py-2">{formatMoney(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
