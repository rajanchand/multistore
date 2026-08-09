import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import { BannerForm, type BannerBranchOption } from '@/components/banner-form';

export default async function NewBannerPage() {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

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
          / New
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Add banner</h1>
        <p className="text-sm text-muted-foreground">
          Upload an image, choose type and status, and target all or selected branches
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Banner details</CardTitle>
        </CardHeader>
        <CardContent>
          <BannerForm mode="create" branches={branches.filter((b) => b.code !== 'HQ')} />
        </CardContent>
      </Card>
    </div>
  );
}
