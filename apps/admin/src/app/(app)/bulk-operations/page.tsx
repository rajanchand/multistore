import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

export default async function BulkOperationsPage() {
  const token = cookies().get('admin_session')?.value;
  const data = await api<{
    items: Array<{
      id: string;
      action: string;
      status: string;
      totalItems: number;
      processedItems: number;
      failedItems: number;
      createdAt: string;
    }>;
  }>('/bulk-operations?pageSize=50', {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk operations</h1>
        <p className="text-sm text-muted-foreground">Queued multi-branch catalogue mutations via BullMQ</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Progress</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((op) => (
                <tr key={op.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{op.action}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{op.status}</Badge>
                  </td>
                  <td className="py-3">
                    {op.processedItems}/{op.totalItems}
                    {op.failedItems > 0 ? ` (${op.failedItems} failed)` : ''}
                  </td>
                  <td className="py-3">{new Date(op.createdAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
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
