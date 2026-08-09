import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

interface AuditList {
  items: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    createdAt: string;
    ipAddress: string | null;
    actor: { firstName: string; lastName: string; email: string } | null;
    branch: { name: string; code: string } | null;
  }>;
}

export default async function ActivityPage() {
  const token = cookies().get('admin_session')?.value;
  const data = await api<AuditList>('/audit-logs?pageSize=50', {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity logs</h1>
        <p className="text-sm text-muted-foreground">Append-only audit trail of admin operations</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">When</th>
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Resource</th>
                <th className="pb-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-3 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString('en-GB')}
                  </td>
                  <td className="py-3">
                    {row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : 'System'}
                  </td>
                  <td className="py-3">{row.branch?.name ?? '—'}</td>
                  <td className="py-3 font-mono text-xs">{row.action}</td>
                  <td className="py-3">
                    {row.resourceType}
                    {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}` : ''}
                  </td>
                  <td className="py-3">{row.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
