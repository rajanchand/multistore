import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { PosTerminalDisplay } from '@/components/pos-terminal-display';

export default async function PosTerminalPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const user = await getAdminSession();
  if (!user) redirect('/login');
  if (!user.permissions.includes('pos.use')) redirect('/dashboard');

  return (
    <div className="space-y-2">
      <div className="text-center">
        <h1 className="text-lg font-semibold">POS machine</h1>
        <p className="text-sm text-muted-foreground">
          Customer-facing amount display (mock terminal for development)
        </p>
      </div>
      <PosTerminalDisplay sessionId={params.sessionId} />
    </div>
  );
}
