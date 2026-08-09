import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function BulkOperationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let op: {
    id: string;
    action: string;
    status: string;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    error?: string | null;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    payload: unknown;
    actor?: { firstName: string; lastName: string; email: string } | null;
    items: Array<{
      id: string;
      branchId: string;
      productId: string;
      status: string;
      error?: string | null;
    }>;
  };

  try {
    op = await api(`/bulk-operations/${params.id}`, {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/bulk-operations" className="hover:underline">
            Bulk operations
          </Link>{' '}
          / {op.action}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{op.action}</h1>
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
        </div>
        <p className="text-sm text-muted-foreground">
          {op.processedItems}/{op.totalItems} processed
          {op.failedItems > 0 ? ` · ${op.failedItems} failed` : ''}
          {op.actor ? ` · by ${op.actor.firstName} ${op.actor.lastName}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Created: {new Date(op.createdAt).toLocaleString('en-GB')}</p>
          <p>
            Started:{' '}
            {op.startedAt ? new Date(op.startedAt).toLocaleString('en-GB') : '—'}
          </p>
          <p>
            Completed:{' '}
            {op.completedAt ? new Date(op.completedAt).toLocaleString('en-GB') : '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample items (up to 50)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {op.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{item.productId.slice(0, 8)}…</td>
                  <td className="py-2 font-mono text-xs">{item.branchId.slice(0, 8)}…</td>
                  <td className="py-2">
                    <Badge variant={item.status === 'FAILED' ? 'destructive' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-destructive">{item.error ?? '—'}</td>
                </tr>
              ))}
              {op.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No item rows yet
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
