import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function SettingsBranchesPage() {
  const token = cookies().get('admin_session')?.value;
  let branches: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
    isActive: boolean;
  }> = [];
  let error: string | null = null;

  try {
    branches = await api<typeof branches>('/branches?includeInactive=true', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load branches';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings" className="hover:underline">
              Settings
            </Link>{' '}
            / Branches
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Branches</h1>
          <p className="text-sm text-muted-foreground">Store locations configured for the platform</p>
        </div>
        <Button asChild>
          <Link href="/branches">Manage branches</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Locations ({branches.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">City</th>
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
                    <Badge variant={b.isActive ? 'success' : 'secondary'}>
                      {b.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <Link className="text-primary hover:underline" href={`/branches/${b.id}`}>
                      Open
                    </Link>
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
