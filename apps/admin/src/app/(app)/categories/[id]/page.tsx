import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';
import { CatalogueEntityForm } from '@/components/catalogue-entity-form';
import { CatalogueEntityActions } from '@/components/catalogue-entity-actions';

export default async function CategoryDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get('admin_session')?.value;
  const headers: Record<string, string> | undefined = token
    ? { Cookie: `admin_session=${token}` }
    : undefined;

  let category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    sortOrder: number;
    isVisible: boolean;
    allBranches: boolean;
    branches: Array<{ branch: { id: string; name: string; code: string } }>;
    _count: { products: number };
  };
  try {
    category = await api(`/categories/${params.id}`, { token, cache: 'no-store', headers });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  const branches = await api<Array<{ id: string; name: string; code: string }>>('/branches', {
    token,
    cache: 'no-store',
    headers,
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/categories" className="hover:underline">
              Categories
            </Link>{' '}
            / {category.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{category.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={category.isVisible ? 'success' : 'secondary'}>
              {category.isVisible ? 'Visible' : 'Hidden'}
            </Badge>
            <Badge variant="outline">{category._count.products} products</Badge>
          </div>
        </div>
        <CatalogueEntityActions kind="categories" id={category.id} isVisible={category.isVisible} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit category</CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogueEntityForm
            kind="categories"
            mode="edit"
            branches={branches.filter((b) => b.code !== 'HQ')}
            initial={{
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description,
              image: category.image,
              sortOrder: category.sortOrder,
              isVisible: category.isVisible,
              allBranches: category.allBranches,
              branchIds: category.branches.map((b) => b.branch.id),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
