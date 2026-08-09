import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { SmsComposeForm } from '@/components/sms-compose-form';

type Branch = { id: string; name: string; code: string };
type Campaign = {
  id: string;
  name: string;
  status: string;
  audience?: { segment?: string } | null;
  branches?: Array<{ branch: Branch }>;
};
type Offer = {
  id: string;
  name: string;
  type: string;
  value: number;
  status: string;
  description?: string | null;
  coupons?: Array<{ code: string; isActive: boolean }>;
};

async function softFetch<T>(path: string, token: string | undefined, fallback: T): Promise<T> {
  if (!token) return fallback;
  try {
    return await api<T>(path, {
      token,
      cache: 'no-store',
      headers: { Cookie: `admin_session=${token}` },
    });
  } catch {
    return fallback;
  }
}

export default async function SmsPage() {
  const token = cookies().get('admin_session')?.value;

  let messages: Array<{
    id: string;
    toPhone: string;
    body: string;
    status: string;
    provider: string;
    createdAt: string;
    customer?: { firstName: string; lastName: string } | null;
    branch?: { code: string } | null;
    campaign?: { name: string } | null;
  }> = [];
  let branches: Branch[] = [];
  let campaigns: Campaign[] = [];
  let offers: Offer[] = [];
  let error: string | null = null;

  try {
    const [sms, branchList, campaignList, promoPage] = await Promise.all([
      api<{ items: typeof messages }>('/sms?pageSize=50', {
        token,
        cache: 'no-store',
        headers: token ? { Cookie: `admin_session=${token}` } : {},
      }),
      api<Branch[]>('/branches', {
        token,
        cache: 'no-store',
        headers: token ? { Cookie: `admin_session=${token}` } : {},
      }),
      softFetch<Campaign[]>('/campaigns', token, []),
      softFetch<{ items: Offer[] }>('/promotions?pageSize=100&status=ACTIVE', token, { items: [] }),
    ]);
    messages = sms.items;
    branches = branchList.filter((b) => b.code !== 'HQ');
    campaigns = campaignList;
    offers = promoPage.items;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load SMS data';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SMS</h1>
        <p className="text-sm text-muted-foreground">
          Pick mode, campaign, segment, branch, and offer — Gemini writes the message, then you send.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SmsComposeForm branches={branches} campaigns={campaigns} offers={offers} />

      <Card>
        <CardHeader>
          <CardTitle>Recent messages ({messages.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">To</th>
                <th className="pb-2 font-medium">Message</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-3">
                    <p className="font-mono text-xs">{m.toPhone}</p>
                    {m.customer && (
                      <p className="text-xs text-muted-foreground">
                        {m.customer.firstName} {m.customer.lastName}
                      </p>
                    )}
                  </td>
                  <td className="py-3 max-w-xs truncate">{m.body}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        m.status === 'SENT' ? 'success' : m.status === 'FAILED' ? 'destructive' : 'secondary'
                      }
                    >
                      {m.status}
                    </Badge>
                  </td>
                  <td className="py-3">{m.provider}</td>
                  <td className="py-3">{new Date(m.createdAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
              {!error && messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No SMS messages yet
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
