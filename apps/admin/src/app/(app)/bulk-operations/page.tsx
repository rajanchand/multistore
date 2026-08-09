import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { BulkOperationForm } from '@/components/bulk-operation-form';

export default async function BulkOperationsPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let ops: Array<{
    id: string;
    action: string;
    status: string;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    createdAt: string;
  }> = [];
  let branches: Array<{ id: string; name: string; code: string }> = [];
  let products: Array<{ id: string; name: string; sku: string }> = [];
  let categories: Array<{ id: string; name: string }> = [];
  let promotions: Array<{ id: string; name: string }> = [];
  let error: string | null = null;

  try {
    const [opsRes, branchRes, productRes, categoryRes, promoRes] = await Promise.all([
      api<{ items: typeof ops }>('/bulk-operations?pageSize=50', {
        token,
        cache: 'no-store',
        headers,
      }),
      api<typeof branches>('/branches', { token, cache: 'no-store', headers }),
      api<{ items: Array<{ id: string; name: string; sku: string }> }>('/products?pageSize=100', {
        token,
        cache: 'no-store',
        headers,
      }).catch(() => ({ items: [] as Array<{ id: string; name: string; sku: string }> })),
      api<Array<{ id: string; name: string }>>('/categories', {
        token,
        cache: 'no-store',
        headers,
      }).catch(() => []),
      api<{ items?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>>(
        '/promotions?pageSize=100',
        {
          token,
          cache: 'no-store',
          headers,
        },
      ).catch(() => ({ items: [] })),
    ]);
    ops = opsRes.items;
    branches = branchRes.filter((b) => b);
    products = productRes.items;
    categories = categoryRes;
    promotions = Array.isArray(promoRes) ? promoRes : (promoRes.items ?? []);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load bulk operations';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk operations</h1>
        <p className="text-sm text-muted-foreground">
          Preview and queue multi-branch catalogue mutations
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New job</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkOperationForm
            branches={branches}
            products={products}
            categories={categories}
            promotions={promotions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Progress</th>
                <th className="pb-2 font-medium">Created</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {ops.map((op) => (
                <tr key={op.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{op.action}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        op.status === 'COMPLETED'
                          ? 'success'
                          : op.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {op.status}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {op.processedItems}/{op.totalItems}
                    {op.failedItems > 0 ? ` (${op.failedItems} failed)` : ''}
                  </td>
                  <td className="py-3">{new Date(op.createdAt).toLocaleString('en-GB')}</td>
                  <td className="py-3 text-right">
                    <Link href={`/bulk-operations/${op.id}`} className="underline">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
              {!error && ops.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No bulk operations yet
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
