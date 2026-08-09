import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { getAdminSession } from '@/lib/auth';
import { StaffUserForm, type StaffBranch, type StaffRole, type StaffUserInitial } from '@/components/staff-user-form';
import { StaffUserActions } from '@/components/staff-user-actions';

export default async function StaffUserDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;
  const me = await getAdminSession();

  let user: StaffUserInitial;
  try {
    user = await api<StaffUserInitial>(`/users/${params.id}`, {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  const [roles, branches] = await Promise.all([
    api<StaffRole[]>('/users/assignable-roles', { token, cache: 'no-store', headers }).catch(
      () => [],
    ),
    api<StaffBranch[]>('/branches', { token, cache: 'no-store', headers }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/users" className="hover:underline">
            Users & roles
          </Link>{' '}
          / {user.firstName} {user.lastName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {user.firstName} {user.lastName}
          </h1>
          <Badge variant={user.isActive ? 'success' : 'secondary'}>
            {user.isActive ? 'Active' : 'Disabled'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          @{user.username} · {user.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff actions</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffUserActions userId={user.id} isActive={user.isActive} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit role, branch & details</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffUserForm
            mode="edit"
            roles={roles}
            branches={branches}
            initial={user}
            actorIsGlobal={Boolean(me?.isGlobal)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
