import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { storeApi } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

export const metadata: Metadata = {
  title: 'Shop products',
  description:
    'Browse Neighbourhood Market products at your selected branch — drinks, fruit, snacks, and household essentials.',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const branchId = cookies().get('preferred_branch')?.value;
  const branches = await storeApi<Array<{ id: string }>>('/storefront/branches', {
    next: { revalidate: 45 },
  }).catch(() => []);
  const resolved = branchId ?? branches[0]?.id;
  if (!resolved) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-[var(--nm-muted)]">
        No branches available.
      </div>
    );
  }

  const qs = new URLSearchParams({
    branchId: resolved,
    pageSize: '24',
    sort: 'newest',
  });
  if (searchParams.q) qs.set('search', searchParams.q);
  if (searchParams.category) qs.set('categorySlug', searchParams.category);

  const data = await storeApi<{
    items: Array<{
      productId: string;
      variantId: string;
      name: string;
      slug: string;
      price: number;
      salePrice: number | null;
      images: string[];
      inStock: boolean;
      brand: string | null;
    }>;
    total: number;
  }>(`/storefront/products?${qs}`, { next: { revalidate: 45 } }).catch(() => ({
    items: [],
    total: 0,
  }));

  const categoryLabel = searchParams.category
    ? searchParams.category.replace(/-/g, ' ')
    : 'all products';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 nm-animate-in">
      <h1 className="font-display text-4xl font-bold tracking-tight text-black">
        {searchParams.category ? categoryLabel.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Shop'}
      </h1>
      <p className="mt-2 text-sm font-medium text-[var(--nm-muted)]">
        {data.total} products at your branch
        {searchParams.q ? ` matching “${searchParams.q}”` : ''}
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
        {data.items.length === 0 && (
          <p className="col-span-full border border-dashed border-[var(--nm-line)] bg-white px-4 py-12 text-center text-sm text-[var(--nm-muted)]">
            No products match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
