import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';

export default async function UsersPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  const data = await api<{
    items: Array<{
      id: string;
      email: string;
      username: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      isGlobal: boolean;
      roles: Array<{ role: { name: string } }>;
      branches: Array<{ branch: { code: string } }>;
    }>;
  }>('/users?pageSize=100', {
    token,
    cache: 'no-store',
    headers,
  }).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users & roles</h1>
          <p className="text-sm text-muted-foreground">
            Create staff accounts and manage roles, branches, and status
          </p>
        </div>
        <Button asChild>
          <Link href="/users/new">Create staff user</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Staff accounts ({data.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Username</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Roles</th>
                <th className="pb-2 font-medium">Branches</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-3">
                    <Link href={`/users/${u.id}`} className="font-medium hover:underline">
                      {u.firstName} {u.lastName}
                    </Link>
                  </td>
                  <td className="py-3 font-mono text-xs">{u.username}</td>
                  <td className="py-3">{u.email}</td>
                  <td className="py-3">{u.roles.map((r) => r.role.name).join(', ') || '—'}</td>
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
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No staff found
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
