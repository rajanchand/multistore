import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function InventoryReportPage() {
  const token = cookies().get('admin_session')?.value;
  let data: {
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
  } | null = null;
  let error: string | null = null;

  try {
    data = await api('/reports/inventory', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load inventory report';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/reports" className="hover:underline">
            Reports
          </Link>{' '}
          / Inventory
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Inventory report</h1>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">SKU rows</p>
                <p className="text-2xl font-semibold">{data.totals.skuRows}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-2xl font-semibold">{data.totals.available}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Reserved</p>
                <p className="text-2xl font-semibold">{data.totals.reserved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Incoming</p>
                <p className="text-2xl font-semibold">{data.totals.incoming}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>By branch</CardTitle>
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
                  {data.byBranch.map((b) => (
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
          <Card>
            <CardHeader>
              <CardTitle>Low stock items</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Branch</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Available</th>
                    <th className="pb-2 font-medium">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStock.map((row) => (
                    <tr key={`${row.branchCode}-${row.sku}`} className="border-b last:border-0">
                      <td className="py-2">{row.branchCode}</td>
                      <td className="py-2 font-mono text-xs">{row.sku}</td>
                      <td className="py-2">{row.productName}</td>
                      <td className="py-2">{row.available}</td>
                      <td className="py-2">{row.threshold}</td>
                    </tr>
                  ))}
                  {data.lowStock.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No low-stock items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
