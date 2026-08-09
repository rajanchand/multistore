import Link from 'next/link';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui';
import { storeApi } from '@/lib/api';
import { getCustomerSession } from '@/lib/auth';

type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  total: number;
  currency: string;
  fulfilmentType: string;
  branch: { id: string; name: string };
  items: Array<{ id: string; productName: string; quantity: number; lineTotal: number }>;
};

type OrderListResponse = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPlacedAt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function itemsSummary(items: OrderListItem['items']) {
  if (items.length === 0) return 'No items';
  const parts = items.map((item) =>
    item.quantity > 1 ? `${item.productName} ×${item.quantity}` : item.productName,
  );
  if (parts.length <= 2) return parts.join(', ');
  return `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more`;
}

export default async function AccountOrdersPage() {
  const customer = await getCustomerSession();

  if (!customer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">Your orders</h1>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>View your order history after signing in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>Sign in to see past orders, status updates, and totals for your account.</p>
            <Button asChild>
              <Link href="/account">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const token = cookies().get('customer_session')?.value;
  const preferredBranch = cookies().get('preferred_branch')?.value;

  let orders: OrderListResponse | null = null;
  let loadError: string | null = null;
  try {
    orders = await storeApi<OrderListResponse>('/my/orders?pageSize=50', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `customer_session=${token}` } : undefined,
    });
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Unable to load orders';
  }

  const items = orders?.items ?? [];
  const sorted = preferredBranch
    ? [...items].sort((a, b) => {
        const aMatch = a.branch.id === preferredBranch ? 0 : 1;
        const bMatch = b.branch.id === preferredBranch ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
      })
    : items;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--nm-ink)]">Your orders</h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as {customer.firstName} {customer.lastName}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/account">Account</Link>
        </Button>
      </div>

      {loadError && (
        <p className="mt-8 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && sorted.length === 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>No orders yet</CardTitle>
            <CardDescription>When you place an order, it will show up here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/products">Start shopping</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loadError && sorted.length > 0 && (
        <ul className="mt-8 space-y-4">
          {sorted.map((order) => {
            const atCurrentBranch = preferredBranch != null && order.branch.id === preferredBranch;
            return (
              <li key={order.id}>
                <Card>
                  <CardHeader className="space-y-1 pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      <p className="text-base font-semibold tabular-nums">
                        {formatMoney(order.total, order.currency)}
                      </p>
                    </div>
                    <CardDescription>
                      {formatPlacedAt(order.placedAt)} · {formatStatus(order.status)}
                      {order.fulfilmentType === 'COLLECTION' ? ' · Collection' : ' · Delivery'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">{order.branch.name}</span>
                      {atCurrentBranch ? ' · Your selected branch' : null}
                    </p>
                    <p>{itemsSummary(order.items)}</p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {orders && orders.totalPages > 1 && (
        <p className="mt-6 text-center text-sm text-slate-500">
          Showing {sorted.length} of {orders.total} orders
        </p>
      )}
    </div>
  );
}
