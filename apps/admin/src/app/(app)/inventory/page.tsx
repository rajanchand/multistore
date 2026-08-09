import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import { getSelectedBranchId, withBranchQuery } from '@/lib/branch-context';

interface InventoryList {
  items: Array<{
    id: string;
    available: number;
    reserved: number;
    lowStockThreshold: number;
    branch: { name: string; code: string };
    variant: { name: string; sku: string; product: { name: string } };
  }>;
}

export default async function InventoryPage() {
  const token = cookies().get('admin_session')?.value;
  const branchId = getSelectedBranchId();
  const data = await api<InventoryList>(
    withBranchQuery('/inventory?pageSize=50&lowStockOnly=false', branchId),
    {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    },
  ).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock across authorised branches{branchId ? ' · branch filter on' : ''}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Available</th>
                <th className="pb-2 font-medium">Reserved</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const low = row.available <= row.lowStockThreshold;
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">{row.variant.product.name}</div>
                      <div className="text-xs text-muted-foreground">{row.variant.name}</div>
                    </td>
                    <td className="py-3 font-mono text-xs">{row.variant.sku}</td>
                    <td className="py-3">{row.branch.name}</td>
                    <td className="py-3">{row.available}</td>
                    <td className="py-3">{row.reserved}</td>
                    <td className="py-3">
                      <Badge variant={row.available === 0 ? 'destructive' : low ? 'warning' : 'success'}>
                        {row.available === 0 ? 'Out of stock' : low ? 'Low' : 'In stock'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
