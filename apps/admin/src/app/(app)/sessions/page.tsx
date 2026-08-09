import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { SessionActions } from '@/components/session-actions';

interface SessionRow {
  id: string;
  deviceName?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

export default async function SessionsPage() {
  const token = cookies().get('admin_session')?.value;
  let sessions: SessionRow[] = [];
  let error: string | null = null;

  try {
    const data = await api<{ items: SessionRow[] }>('/auth/sessions', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
    sessions = data.items ?? [];
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load sessions';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Login sessions</h1>
          <p className="text-sm text-muted-foreground">
            Active sessions for your admin account. Revoke anything you do not recognise.
          </p>
        </div>
        <SessionActions />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active sessions ({sessions.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Device</th>
                <th className="pb-2 font-medium">IP</th>
                <th className="pb-2 font-medium">Last active</th>
                <th className="pb-2 font-medium">Created</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-3">
                    <p className="font-medium">{s.deviceName || 'Browser session'}</p>
                    <p className="max-w-xs truncate text-xs text-muted-foreground">
                      {s.userAgent || '—'}
                    </p>
                  </td>
                  <td className="py-3">{s.ip || '—'}</td>
                  <td className="py-3">{new Date(s.lastActiveAt).toLocaleString('en-GB')}</td>
                  <td className="py-3">{new Date(s.createdAt).toLocaleString('en-GB')}</td>
                  <td className="py-3">
                    <Badge variant={s.isCurrent ? 'success' : 'secondary'}>
                      {s.isCurrent ? 'Current' : 'Active'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <SessionActions sessionId={s.id} isCurrent={s.isCurrent} />
                  </td>
                </tr>
              ))}
              {!error && sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No active sessions
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
