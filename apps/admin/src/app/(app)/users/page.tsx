import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

export default async function UsersPage() {
  const token = cookies().get('admin_session')?.value;
  const data = await api<{
    items: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      isGlobal: boolean;
      roles: Array<{ role: { name: string } }>;
      branches: Array<{ branch: { code: string } }>;
    }>;
  }>('/users?pageSize=50', {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users & roles</h1>
        <p className="text-sm text-muted-foreground">Permission-based access with branch isolation</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Staff accounts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Roles</th>
                <th className="pb-2 font-medium">Branches</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="py-3">{u.email}</td>
                  <td className="py-3">{u.roles.map((r) => r.role.name).join(', ')}</td>
                  <td className="py-3">
                    {u.isGlobal ? 'All (HQ)' : u.branches.map((b) => b.branch.code).join(', ') || '—'}
                  </td>
                  <td className="py-3">
                    <Badge variant={u.isActive ? 'success' : 'secondary'}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </Badge>
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
