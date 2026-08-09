import Link from 'next/link';
import { cookies } from 'next/headers';
import { formatMoney } from '@repo/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { api } from '@/lib/api';
import { getSelectedBranchId, withBranchQuery } from '@/lib/branch-context';

interface ProductList {
  items: Array<{
    id: string;
    name: string;
    sku: string;
    status: string;
    totalStock: number;
    branchCount: number;
    priceRange: { min: number | null; max: number | null };
    categories: Array<{ category: { name: string } }>;
    images: string[];
  }>;
  total: number;
}

export default async function ProductsPage() {
  const token = cookies().get('admin_session')?.value;
  const branchId = getSelectedBranchId();
  const data = await api<ProductList>(withBranchQuery('/products?pageSize=50', branchId), {
    token,
    cache: 'no-store',
    headers: token ? { Cookie: `admin_session=${token}` } : {},
  }).catch(() => ({ items: [], total: 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {data.total} products in the master catalogue
            {branchId ? ' · branch filter on' : ''}
          </p>
          <p className="mt-2 text-sm">
            <Link className="text-primary hover:underline" href="/categories">
              Categories
            </Link>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link className="text-primary hover:underline" href="/brands">
              Brands
            </Link>
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">Create product</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Image</th>
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Branches</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Stock</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="h-10 w-10 overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          Array.isArray(p.images) && p.images[0]
                            ? p.images[0]
                            : 'https://placehold.co/80x80/e2e8f0/64748b?text=—'
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </td>
                  <td className="py-3 font-medium">{p.name}</td>
                  <td className="py-3 font-mono text-xs">{p.sku}</td>
                  <td className="py-3">{p.categories[0]?.category.name ?? '—'}</td>
                  <td className="py-3">{p.branchCount}</td>
                  <td className="py-3">
                    {p.priceRange.min == null
                      ? '—'
                      : p.priceRange.min === p.priceRange.max
                        ? formatMoney(p.priceRange.min)
                        : `${formatMoney(p.priceRange.min)} – ${formatMoney(p.priceRange.max!)}`}
                  </td>
                  <td className="py-3">{p.totalStock}</td>
                  <td className="py-3">
                    <Badge variant={p.status === 'ACTIVE' ? 'success' : 'secondary'}>{p.status}</Badge>
                  </td>
                  <td className="py-3">
                    <Link className="text-primary hover:underline" href={`/products/${p.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
