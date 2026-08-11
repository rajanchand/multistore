import { cookies } from 'next/headers';
import Link from 'next/link';
import { storeApi } from '@/lib/api';

export async function CategoriesBar() {
  const branchId = cookies().get('preferred_branch')?.value;
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const categories = await storeApi<Array<{ id: string; name: string; slug: string }>>(
    `/storefront/categories${qs}`,
    { next: { revalidate: 60 } },
  ).catch(() => [] as Array<{ id: string; name: string; slug: string }>);

  if (categories.length === 0) return null;

  return (
    <div className="sticky top-16 z-30 border-b border-[var(--nm-line)]/70 bg-[var(--nm-surface)]/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="nm-scrollbar-none flex gap-1 overflow-x-auto py-2">
          <Link
            href="/products"
            className="inline-flex shrink-0 items-center rounded-lg bg-[var(--nm-accent)] px-3.5 py-2 text-xs font-semibold text-white"
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="inline-flex shrink-0 items-center rounded-lg px-3.5 py-2 text-xs font-semibold text-[var(--nm-muted)] transition hover:bg-[var(--nm-soft)] hover:text-[var(--nm-accent)]"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
