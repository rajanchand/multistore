import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { BannerActions } from '@/components/banner-actions';
import { BannerForm, type BannerBranchOption, type BannerFormInitial } from '@/components/banner-form';

export default async function BannerDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let banner: BannerFormInitial;
  try {
    banner = await api<BannerFormInitial>(`/banners/${params.id}`, {
      token,
      cache: 'no-store',
      headers,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  const branches = await api<BannerBranchOption[]>('/branches', {
    token,
    cache: 'no-store',
    headers,
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/banners" className="hover:underline">
            Banners
          </Link>{' '}
          / {banner.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{banner.title}</h1>
          <Badge variant={banner.status === 'ACTIVE' ? 'success' : 'secondary'}>
            {banner.status}
          </Badge>
          <Badge variant="outline">{banner.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {banner.isGlobal
            ? 'All branches'
            : banner.branches?.map((b) => b.branch.code).join(', ') || 'No branches'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status actions</CardTitle>
        </CardHeader>
        <CardContent>
          <BannerActions id={banner.id!} status={banner.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit banner</CardTitle>
        </CardHeader>
        <CardContent>
          <BannerForm
            mode="edit"
            branches={branches.filter((b) => b.code !== 'HQ')}
            initial={banner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
