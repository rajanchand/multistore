import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { ORDER_SOURCE_LABELS, formatMoney, type OrderSource } from '@repo/types';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  source: OrderSource;
  fulfilmentType: string;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  taxTotal: number;
  total: number;
  currency: string;
  placedAt: string;
  notes?: string | null;
  branch: { id: string; name: string; code: string };
  customer: { firstName: string; lastName: string; email: string; phone?: string | null };
  items: Array<{
    id: string;
    productName: string;
    variantName?: string | null;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    provider: string;
    createdAt: string;
  }>;
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  let order: OrderDetail;
  try {
    order = await api<OrderDetail>(`/orders/${params.id}`, {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/orders" className="hover:underline">
            Orders
          </Link>{' '}
          / {order.orderNumber}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{order.orderNumber}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{order.status}</Badge>
          <Badge
            variant={
              order.source === 'ONLINE' ? 'default' : order.source === 'POS' ? 'warning' : 'success'
            }
          >
            {ORDER_SOURCE_LABELS[order.source] ?? order.source}
          </Badge>
          <Badge variant="outline">{order.fulfilmentType}</Badge>
          <Badge variant="outline">{order.branch.name}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{item.productName}</p>
                      {item.variantName && (
                        <p className="text-xs text-muted-foreground">{item.variantName}</p>
                      )}
                    </td>
                    <td className="py-3 font-mono text-xs">{item.sku}</td>
                    <td className="py-3">{item.quantity}</td>
                    <td className="py-3">{formatMoney(item.unitPrice, order.currency)}</td>
                    <td className="py-3">{formatMoney(item.lineTotal, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">
                {order.customer.firstName} {order.customer.lastName}
              </p>
              <p className="text-muted-foreground">{order.customer.email}</p>
              <p className="text-muted-foreground">{order.customer.phone ?? '—'}</p>
              <p className="pt-2 text-muted-foreground">
                Placed {new Date(order.placedAt).toLocaleString('en-GB')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
              <Row label="Discount" value={formatMoney(order.discountTotal, order.currency)} />
              <Row label="Delivery" value={formatMoney(order.deliveryFee, order.currency)} />
              <Row label="Tax" value={formatMoney(order.taxTotal, order.currency)} />
              <Row label="Total" value={formatMoney(order.total, order.currency)} strong />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between border-b py-2 last:border-0">
                  <span>
                    {p.provider} · {p.status}
                  </span>
                  <span>{formatMoney(p.amount, order.currency)}</span>
                </div>
              ))}
              {order.payments.length === 0 && (
                <p className="text-muted-foreground">No payments recorded</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
