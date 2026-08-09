import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

export default async function PaymentsPage() {
  const token = cookies().get('admin_session')?.value;
  const data = await api<{
    items: Array<{
      id: string;
      status: string;
      amount: number;
      provider: string;
      order: { orderNumber: string; branch: { name: string } };
    }>;
  }>('/payments?pageSize=50', {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">Provider-confirmed payment ledger</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payment events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Order</th>
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{p.order.orderNumber}</td>
                  <td className="py-3">{p.order.branch.name}</td>
                  <td className="py-3">{p.provider}</td>
                  <td className="py-3">{formatMoney(p.amount)}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{p.status}</Badge>
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
