import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import { CatalogueEntityForm } from '@/components/catalogue-entity-form';

export default async function NewBrandPage() {
  const token = cookies().get('admin_session')?.value;
  const branches = await api<Array<{ id: string; name: string; code: string }>>('/branches', {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/brands" className="hover:underline">
            Brands
          </Link>{' '}
          / New
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Add brand</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Brand details</CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogueEntityForm
            kind="brands"
            mode="create"
            branches={branches.filter((b) => b.code !== 'HQ')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
