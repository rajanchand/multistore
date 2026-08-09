import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { getAdminSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSelectedBranchId } from '@/lib/branch-context';
import { PosTill } from '@/components/pos-till';

export default async function PosPage() {
  const user = await getAdminSession();
  if (!user) redirect('/login');
  if (!user.permissions.includes('pos.use')) redirect('/dashboard');

  const token = cookies().get('admin_session')?.value;
  const selectedBranchId = getSelectedBranchId();

  const branches = await api<Array<{ id: string; name: string; code: string; isActive: boolean }>>(
    '/branches?includeInactive=true',
    {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    },
  )
    .then((list) => list.filter((b) => b.code !== 'HQ' && b.isActive))
    .catch(() => [] as Array<{ id: string; name: string; code: string; isActive: boolean }>);

  const branch =
    (selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null) ??
    (!user.isGlobal && branches.length === 1 ? branches[0] : null) ??
    null;

  if (!branch) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Point of Sale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Select a branch in the header to open the till for that store.</p>
          <p>
            Edinburgh staff should choose Edinburgh — stock and prices are always scoped to the
            selected branch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
        <p className="text-sm text-muted-foreground">
          Scan barcodes, build a ticket, then take cash or card at the till.
        </p>
      </div>
      <PosTill branchId={branch.id} branchName={branch.name} branchCode={branch.code} />
    </div>
  );
}
