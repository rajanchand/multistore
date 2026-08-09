import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function CampaignsPage() {
  const token = cookies().get('admin_session')?.value;
  let items: Array<{
    id: string;
    name: string;
    slug: string;
    channel: string;
    status: string;
    startsAt?: string | null;
    endsAt?: string | null;
    _count?: { smsMessages: number };
  }> = [];
  let error: string | null = null;

  try {
    items = await api<typeof items>('/campaigns', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load campaigns';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Marketing campaigns across email, SMS, and in-app</p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">Create campaign</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All campaigns ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Channel</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">SMS</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{c.name}</td>
                  <td className="py-3">{c.channel}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{c.status}</Badge>
                  </td>
                  <td className="py-3">{c._count?.smsMessages ?? 0}</td>
                  <td className="py-3">
                    <Link className="text-primary hover:underline" href={`/campaigns/${c.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!error && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No campaigns yet
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
