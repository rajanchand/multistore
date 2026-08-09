import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { getAdminSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSelectedBranchId } from '@/lib/branch-context';
import { cookies } from 'next/headers';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminSession();
  if (!user) redirect('/login');

  const token = cookies().get('admin_session')?.value;
  const branches = await api<Array<{ id: string; name: string; code: string; isActive: boolean }>>(
    '/branches?includeInactive=true',
    {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    },
  )
    .then((list) => list.filter((b) => b.code !== 'HQ').map(({ id, name, code }) => ({ id, name, code })))
    .catch(() => [] as Array<{ id: string; name: string; code: string }>);

  return (
    <AdminShell
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        permissions: user.permissions,
        isGlobal: user.isGlobal,
      }}
      branches={branches}
      selectedBranchId={getSelectedBranchId()}
    >
      {children}
    </AdminShell>
  );
}
