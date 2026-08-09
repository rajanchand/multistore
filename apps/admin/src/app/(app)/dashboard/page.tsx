import Link from 'next/link';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import { DashboardCharts } from '@/components/dashboard-charts';
import { getSelectedBranchId, withBranchQuery } from '@/lib/branch-context';

interface DashboardData {
  overview: {
    totalRevenue: number;
    orders: number;
    paidOrders?: number;
    customers: number;
    averageOrderValue: number;
    refundsTotal: number;
    refundsCount?: number;
    lowStockCount: number;
  };
  revenueTrend: { day: string; revenue: number; orders: number }[];
  revenueByBranch: { branch: { name: string; code: string }; revenue: number; orders: number }[];
  topProducts: { productName: string; units: number; revenue: number }[];
  branches: {
    branch: { name: string; code: string; city: string };
    revenue: number;
    orders: number;
    customers: number;
    averageOrderValue: number;
    refundRateBps: number;
    lowStockCount: number;
  }[];
}

interface TodayGlance {
  totalRevenue: number;
  orders: number;
  customers: number;
  averageOrderValue: number;
}

interface ActivityRow {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
  actor?: { firstName?: string; lastName?: string } | null;
}

export default async function DashboardPage() {
  const token = cookies().get('admin_session')?.value;
  const branchId = getSelectedBranchId();
  let data: DashboardData | null = null;
  let today: TodayGlance | null = null;
  let activity: ActivityRow[] = [];
  let error: string | null = null;

  try {
    const [dash, todayDash, audit] = await Promise.all([
      api<DashboardData>(withBranchQuery('/analytics/dashboard?range=30d', branchId), {
        token,
        cache: 'no-store',
        headers: token ? { Cookie: `admin_session=${token}` } : {},
      }),
      api<TodayGlance>(withBranchQuery('/analytics/overview?range=today', branchId), {
        token,
        cache: 'no-store',
        headers: token ? { Cookie: `admin_session=${token}` } : {},
      }).catch(() => null),
      api<{ items: ActivityRow[] }>('/audit-logs?pageSize=8', {
        token,
        cache: 'no-store',
        headers: token ? { Cookie: `admin_session=${token}` } : {},
      }).catch(() => ({ items: [] as ActivityRow[] })),
    ]);
    data = dash;
    today = todayDash;
    activity = audit.items ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load dashboard';
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error ?? 'Unable to load dashboard'}
      </div>
    );
  }

  const selectedLabel = branchId
    ? data.branches.find((b) => false) ||
      data.revenueByBranch.find(() => false)
    : null;
  void selectedLabel;

  const kpis = [
    { label: 'Revenue (30d)', value: formatMoney(data.overview.totalRevenue), href: '/reports/sales' },
    { label: 'Orders', value: String(data.overview.orders), href: '/orders' },
    { label: 'Customers', value: String(data.overview.customers), href: '/customers' },
    { label: 'AOV', value: formatMoney(data.overview.averageOrderValue), href: '/reports' },
    { label: 'Refunds', value: formatMoney(data.overview.refundsTotal), href: '/payments' },
    {
      label: 'Low stock',
      value: String(data.overview.lowStockCount),
      href: '/inventory',
      warn: data.overview.lowStockCount > 0,
    },
  ];

  const topTwo = [...data.revenueByBranch].slice(0, 2);
  const lead = topTwo[0];
  const runnerUp = topTwo[1];
  const compareGap =
    lead && runnerUp && lead.revenue > 0
      ? Math.round(((lead.revenue - runnerUp.revenue) / lead.revenue) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Last 30 days · use the top bar to switch branch context in one click
            {branchId ? ' · filtered branch active' : ' · all branches'}
          </p>
        </div>
        <Badge variant="secondary">Live PostgreSQL aggregates</Badge>
      </div>

      {today && (
        <div className="overflow-hidden rounded-xl border bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Today at a glance</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <Glance label="Revenue" value={formatMoney(today.totalRevenue)} />
            <Glance label="Orders" value={String(today.orders)} />
            <Glance label="Customers" value={String(today.customers)} />
            <Glance label="AOV" value={formatMoney(today.averageOrderValue)} />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-semibold tracking-tight ${
                    kpi.warn ? 'text-amber-700' : ''
                  }`}
                >
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <DashboardCharts
        revenueTrend={data.revenueTrend}
        revenueByBranch={data.revenueByBranch.map((r) => ({
          name: r.branch.name,
          revenue: r.revenue,
          orders: r.orders,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Branch compare</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {topTwo.map((row, i) => (
              <div key={row.branch.code} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    #{i + 1} {row.branch.name}
                  </span>
                  <Badge variant="outline">{row.branch.code}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatMoney(row.revenue)} · {row.orders} orders
                </p>
              </div>
            ))}
            {compareGap != null && (
              <p className="text-xs text-muted-foreground">
                Leader is ahead by ~{compareGap}% revenue vs #2 in this period.
              </p>
            )}
            {topTwo.length === 0 && (
              <p className="text-muted-foreground">No branch revenue in range.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {data.topProducts.slice(0, 8).map((p) => (
                  <tr key={p.productName} className="border-b last:border-0">
                    <td className="py-2 pr-2">{p.productName}</td>
                    <td className="py-2 text-right text-muted-foreground">×{p.units}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.revenue)}</td>
                  </tr>
                ))}
                {data.topProducts.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground">No sales in this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/activity" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {activity.map((a) => (
              <div key={a.id} className="border-b pb-2 last:border-0">
                <p className="font-medium">{a.action.replaceAll('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">
                  {a.resourceType} · {new Date(a.createdAt).toLocaleString('en-GB')}
                  {a.actor
                    ? ` · ${a.actor.firstName ?? ''} ${a.actor.lastName ?? ''}`.trim()
                    : ''}
                </p>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="text-muted-foreground">No recent audit events</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Branch performance</CardTitle>
          <Link href="/reports" className="text-xs text-primary hover:underline">
            Open reports
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Revenue</th>
                <th className="pb-2 font-medium">Orders</th>
                <th className="pb-2 font-medium">AOV</th>
                <th className="pb-2 font-medium">Refund %</th>
                <th className="pb-2 font-medium">Low stock</th>
              </tr>
            </thead>
            <tbody>
              {data.branches.map((row) => (
                <tr key={row.branch.code} className="border-b last:border-0">
                  <td className="py-2">
                    <div className="font-medium">{row.branch.name}</div>
                    <div className="text-xs text-muted-foreground">{row.branch.city}</div>
                  </td>
                  <td className="py-2">{formatMoney(row.revenue)}</td>
                  <td className="py-2">{row.orders}</td>
                  <td className="py-2">{formatMoney(row.averageOrderValue)}</td>
                  <td className="py-2">{(row.refundRateBps / 100).toFixed(1)}%</td>
                  <td className="py-2">
                    {row.lowStockCount > 0 ? (
                      <Link href="/inventory">
                        <Badge variant="warning">{row.lowStockCount}</Badge>
                      </Link>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
