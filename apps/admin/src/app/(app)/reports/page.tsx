import Link from 'next/link';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { getSelectedBranchId, withBranchQuery } from '@/lib/branch-context';
import { ReportActions } from '@/components/report-actions';

interface SummaryReport {
  range: { from: string; to: string };
  overview: {
    totalRevenue: number;
    orders: number;
    paidOrders: number;
    customers: number;
    averageOrderValue: number;
    refundsTotal: number;
    lowStockCount: number;
  };
  revenueByBranch: Array<{
    branch: { name: string; code: string };
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{ productName: string; units: number; revenue: number }>;
  inventory: {
    totals: { skuRows: number; available: number; reserved: number; incoming: number };
    byBranch: Array<{
      branchName: string;
      branchCode: string;
      skus: number;
      available: number;
      lowStock: number;
    }>;
    lowStock: Array<{
      branchCode: string;
      sku: string;
      productName: string;
      available: number;
      threshold: number;
    }>;
  };
  orderStatus: Array<{ status: string; count: number }>;
}

export default async function ReportsPage() {
  const token = cookies().get('admin_session')?.value;
  const branchId = getSelectedBranchId();
  let report: SummaryReport | null = null;
  let error: string | null = null;

  try {
    report = await api<SummaryReport>(withBranchQuery('/reports/summary?range=30d', branchId), {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load reports';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          HQ sales, orders, and inventory snapshot (last 30 days)
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link className="text-primary hover:underline" href="/reports/sales">
            Sales detail
          </Link>
          <Link className="text-primary hover:underline" href="/reports/orders">
            Orders detail
          </Link>
          <Link className="text-primary hover:underline" href="/reports/inventory">
            Inventory detail
          </Link>
        </div>
        <div className="mt-4">
          <ReportActions kind="summary" range="30d" branchId={branchId} />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Revenue" value={formatMoney(report.overview.totalRevenue)} />
            <Stat label="Orders" value={String(report.overview.orders)} />
            <Stat label="Customers" value={String(report.overview.customers)} />
            <Stat label="AOV" value={formatMoney(report.overview.averageOrderValue)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by branch</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Branch</th>
                      <th className="pb-2 font-medium">Orders</th>
                      <th className="pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.revenueByBranch.map((row) => (
                      <tr key={row.branch.code} className="border-b last:border-0">
                        <td className="py-2">
                          {row.branch.name}{' '}
                          <Badge variant="outline">{row.branch.code}</Badge>
                        </td>
                        <td className="py-2">{row.orders}</td>
                        <td className="py-2">{formatMoney(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {report.topProducts.slice(0, 10).map((p) => (
                  <div key={p.productName} className="flex justify-between border-b py-2 last:border-0">
                    <span>
                      {p.productName}{' '}
                      <span className="text-muted-foreground">×{p.units}</span>
                    </span>
                    <span>{formatMoney(p.revenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Inventory health · {report.inventory.totals.skuRows} SKU rows ·{' '}
                {report.overview.lowStockCount} low-stock
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Branch</th>
                    <th className="pb-2 font-medium">SKUs</th>
                    <th className="pb-2 font-medium">Available</th>
                    <th className="pb-2 font-medium">Low stock</th>
                  </tr>
                </thead>
                <tbody>
                  {report.inventory.byBranch.map((b) => (
                    <tr key={b.branchCode} className="border-b last:border-0">
                      <td className="py-2">
                        {b.branchName} ({b.branchCode})
                      </td>
                      <td className="py-2">{b.skus}</td>
                      <td className="py-2">{b.available}</td>
                      <td className="py-2">{b.lowStock}</td>
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
