import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { getAdminSession } from '@/lib/auth';
import { StaffUserForm, type StaffBranch, type StaffRole } from '@/components/staff-user-form';

export default async function NewStaffUserPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;
  const me = await getAdminSession();

  let roles: StaffRole[] = [];
  let branches: StaffBranch[] = [];
  let error: string | null = null;

  try {
    [roles, branches] = await Promise.all([
      api<StaffRole[]>('/users/assignable-roles', { token, cache: 'no-store', headers }),
      api<StaffBranch[]>('/branches', { token, cache: 'no-store', headers }),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load form data';
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/users" className="hover:underline">
            Users & roles
          </Link>{' '}
          / New staff
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Create staff user</h1>
        <p className="text-sm text-muted-foreground">
          Name, username, password, email, roles, branch access, and status
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Staff details</CardTitle>
        </CardHeader>
        <CardContent>
          {!error && (
            <StaffUserForm
              mode="create"
              roles={roles}
              branches={branches}
              actorIsGlobal={Boolean(me?.isGlobal)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
