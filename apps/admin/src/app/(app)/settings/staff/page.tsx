import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function SettingsStaffPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let items: Array<{
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    isGlobal: boolean;
    roles: Array<{ role: { name: string } }>;
    branches: Array<{ branch: { code: string } }>;
  }> = [];
  let error: string | null = null;

  try {
    const data = await api<{ items: typeof items }>('/users?pageSize=100', {
      token,
      cache: 'no-store',
      headers,
    });
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load staff';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:underline">
              Settings
            </Link>{' '}
            / Staff
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Admin users with role and branch scope — open a user for delete, role, branch, disable,
            and password reset
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/users">Users & Roles</Link>
          </Button>
          <Button asChild>
            <Link href="/users/new">Create staff</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Staff accounts ({items.length})</CardTitle>
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
              {items.map((u) => (
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
                    {u.isGlobal ? 'Global' : u.branches.map((b) => b.branch.code).join(', ') || '—'}
                  </td>
                  <td className="py-3">
                    <Badge variant={u.isActive ? 'success' : 'secondary'}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!error && items.length === 0 && (
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
