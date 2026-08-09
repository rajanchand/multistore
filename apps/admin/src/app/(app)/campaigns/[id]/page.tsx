import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  let campaign: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    channel: string;
    status: string;
    startsAt?: string | null;
    endsAt?: string | null;
    content?: { subject?: string; body?: string; ctaLabel?: string; ctaUrl?: string } | null;
    branches: Array<{ branch: { name: string; code: string } }>;
    _count?: { smsMessages: number };
  };

  try {
    campaign = await api(`/campaigns/${params.id}`, {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  const content = campaign.content ?? {};

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/campaigns" className="hover:underline">
            Campaigns
          </Link>{' '}
          / {campaign.slug}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{campaign.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{campaign.status}</Badge>
          <Badge variant="outline">{campaign.channel}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{campaign.description || 'No description'}</p>
            <p className="text-muted-foreground">
              SMS messages: {campaign._count?.smsMessages ?? 0}
            </p>
            <p className="text-muted-foreground">
              Branches:{' '}
              {campaign.branches.length
                ? campaign.branches.map((b) => b.branch.code).join(', ')
                : 'All / unscoped'}
            </p>
            <Link className="text-primary hover:underline" href="/sms">
              Compose SMS for this campaign →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{content.subject || '—'}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{content.body || 'No body'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
