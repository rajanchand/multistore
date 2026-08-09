import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api, ApiError } from '@/lib/api';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  isVisible: boolean;
  allBranches: boolean;
  sortOrder: number;
  _count: { products: number };
  branches: Array<{ branch: { id: string; name: string; code: string } }>;
}

export default async function CategoriesPage() {
  const token = cookies().get('admin_session')?.value;
  let items: CategoryRow[] = [];
  let error: string | null = null;
  try {
    items = await api<CategoryRow[]>('/categories?includeHidden=true', {
      token,
      cache: 'no-store',
      headers: token ? { Cookie: `admin_session=${token}` } : {},
    });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load categories';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/products" className="hover:underline">
              Products
            </Link>{' '}
            / Categories
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Images, visibility, and branch-wise catalogue sections
          </p>
        </div>
        <Button asChild>
          <Link href="/categories/new">Add category</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All categories ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Image</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Visibility</th>
                <th className="pb-2 font-medium">Branches</th>
                <th className="pb-2 font-medium">Products</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-3">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                        —
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    <Link className="font-medium text-primary hover:underline" href={`/categories/${c.id}`}>
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </td>
                  <td className="py-3">
                    <Badge variant={c.isVisible ? 'success' : 'secondary'}>
                      {c.isVisible ? 'Visible' : 'Hidden'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {c.allBranches
                      ? 'All branches'
                      : c.branches.map((b) => b.branch.code).join(', ') || 'None'}
                  </td>
                  <td className="py-3">{c._count.products}</td>
                  <td className="py-3 text-right">
                    <Link className="text-primary hover:underline" href={`/categories/${c.id}`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!error && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No categories yet
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
