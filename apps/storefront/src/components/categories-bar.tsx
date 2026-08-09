import Link from 'next/link';
import {
  Cookie,
  Droplets,
  Flame,
  Home,
  Sparkles,
  Shirt,
  type LucideIcon,
} from 'lucide-react';
import { storeApi } from '@/lib/api';

const ICONS: Record<string, LucideIcon> = {
  'energy-drinks': Flame,
  'soft-drinks': Droplets,
  'water-juice': Droplets,
  snacks: Cookie,
  confectionery: Cookie,
  biscuits: Cookie,
  household: Home,
  'personal-care': Sparkles,
  clothing: Shirt,
};

const DefaultIcon = Sparkles;

export async function CategoriesBar() {
  const categories = await storeApi<Array<{ id: string; name: string; slug: string }>>(
    '/storefront/categories',
    { cache: 'no-store' },
  ).catch(() => [] as Array<{ id: string; name: string; slug: string }>);

  if (categories.length === 0) return null;

  return (
    <div className="sticky top-16 z-30 border-b border-emerald-900/10 bg-white/75 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="nm-scrollbar-none flex gap-2 overflow-x-auto py-2.5">
          <Link
            href="/products"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-900/10 bg-[var(--nm-mist)] px-3 py-1.5 text-xs font-semibold text-[var(--nm-forest)]"
          >
            All
          </Link>
          {categories.map((c) => {
            const Icon = ICONS[c.slug] ?? DefaultIcon;
            return (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-900/15 hover:text-[var(--nm-forest)]"
              >
                <Icon className="h-3.5 w-3.5 opacity-70" />
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
