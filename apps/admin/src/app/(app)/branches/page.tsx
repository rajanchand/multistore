import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  isActive: boolean;
  manager?: { firstName: string; lastName: string } | null;
}

export default async function BranchesPage() {
  const token = cookies().get('admin_session')?.value;
  let branches: Branch[] = [];
  let loadError: string | null = null;

  try {
    branches = await api<Branch[]>('/branches?includeInactive=true', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    loadError =
      e instanceof ApiError
        ? e.message
        : 'Failed to load branches. Check that the API is running.';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branches</h1>
          <p className="text-sm text-muted-foreground">Manage store locations and settings</p>
        </div>
        <Button asChild>
          <Link href="/branches/new">Create branch</Link>
        </Button>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All branches ({branches.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">City</th>
                <th className="pb-2 font-medium">Manager</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{b.name}</td>
                  <td className="py-3">{b.code}</td>
                  <td className="py-3">{b.city}</td>
                  <td className="py-3">
                    {b.manager ? `${b.manager.firstName} ${b.manager.lastName}` : '—'}
                  </td>
                  <td className="py-3">
                    <Badge variant={b.isActive ? 'success' : 'secondary'}>
                      {b.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <Link className="text-primary hover:underline" href={`/branches/${b.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!loadError && branches.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    No branches found
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
