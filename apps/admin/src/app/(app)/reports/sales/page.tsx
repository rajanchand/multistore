import Link from 'next/link';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function SalesReportPage() {
  const token = cookies().get('admin_session')?.value;
  let data: {
    overview: { totalRevenue: number; orders: number; averageOrderValue: number };
    salesByCategory: Array<{ categoryName: string; revenue: number; units: number }>;
    paymentMethods: Array<{ provider: string; status: string; count: number; amount: number }>;
    revenueTrend: Array<{ day: string; revenue: number; orders: number }>;
  } | null = null;
  let error: string | null = null;

  try {
    data = await api('/reports/sales?range=30d', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load sales report';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/reports" className="hover:underline">
            Reports
          </Link>{' '}
          / Sales
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Sales report</h1>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-2xl font-semibold">{formatMoney(data.overview.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-2xl font-semibold">{data.overview.orders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">AOV</p>
                <p className="text-2xl font-semibold">{formatMoney(data.overview.averageOrderValue)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.salesByCategory.map((c) => (
                  <div key={c.categoryName} className="flex justify-between border-b py-2 last:border-0">
                    <span>
                      {c.categoryName} <span className="text-muted-foreground">×{c.units}</span>
                    </span>
                    <span>{formatMoney(c.revenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Payment methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.paymentMethods.map((p) => (
                  <div
                    key={`${p.provider}-${p.status}`}
                    className="flex justify-between border-b py-2 last:border-0"
                  >
                    <span>
                      {p.provider} · {p.status} ({p.count})
                    </span>
                    <span>{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Daily trend</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Day</th>
                    <th className="pb-2 font-medium">Orders</th>
                    <th className="pb-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueTrend.map((d) => (
                    <tr key={d.day} className="border-b last:border-0">
                      <td className="py-2">{d.day}</td>
                      <td className="py-2">{d.orders}</td>
                      <td className="py-2">{formatMoney(d.revenue)}</td>
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
