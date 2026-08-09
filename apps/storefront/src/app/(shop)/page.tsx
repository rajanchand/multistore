import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowRight, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { storeApi } from '@/lib/api';
import { HeroCarousel, type HeroSlide } from '@/components/hero-carousel';
import { ProductCard } from '@/components/product-card';

interface StorefrontBanner {
  id: string;
  title: string;
  type: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  image?: string | null;
  mobileImage?: string | null;
  priority?: number;
}

interface HomeData {
  banners: StorefrontBanner[];
  categories: Array<{ id: string; name: string; slug: string }>;
  newArrivals: Array<{
    productId: string;
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    images: string[];
  }>;
  bestSellers: Array<{
    productId: string;
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    images: string[];
  }>;
}

function toHeroSlides(banners: StorefrontBanner[]): HeroSlide[] {
  const heroes = banners
    .filter((b) => b.type === 'HERO' || b.type === 'MOBILE_HERO')
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  const preferred = heroes.some((b) => b.type === 'HERO')
    ? heroes.filter((b) => b.type === 'HERO')
    : heroes;
  return preferred.map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    ctaLabel: b.ctaLabel,
    ctaUrl: b.ctaUrl,
    image: b.image,
    mobileImage: b.mobileImage,
  }));
}

async function resolveBranchId(): Promise<string | null> {
  const preferred = cookies().get('preferred_branch')?.value;
  if (preferred) return preferred;
  const branches = await storeApi<Array<{ id: string }>>('/storefront/branches', {
    cache: 'no-store',
  }).catch(() => []);
  return branches[0]?.id ?? null;
}

export default async function HomePage() {
  const branchId = await resolveBranchId();
  const [home, banners] = branchId
    ? await Promise.all([
        storeApi<HomeData>(`/storefront/home?branchId=${branchId}`, { cache: 'no-store' }).catch(
          () => null,
        ),
        storeApi<StorefrontBanner[]>(`/storefront/banners?branchId=${branchId}`, {
          cache: 'no-store',
        }).catch(() => [] as StorefrontBanner[]),
      ])
    : [null, [] as StorefrontBanner[]];

  const slides = toHeroSlides((home?.banners?.length ? home.banners : banners) ?? []);

  return (
    <div>
      <HeroCarousel slides={slides} />

      <section className="mx-auto max-w-6xl px-4 py-12 nm-animate-in">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--nm-forest)]">
              Browse
            </p>
            <h2 className="font-display mt-1 text-3xl font-semibold text-[var(--nm-ink)]">
              Popular categories
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden items-center gap-1 text-sm font-semibold text-[var(--nm-forest)] sm:inline-flex"
          >
            Shop all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {(home?.categories ?? []).slice(0, 8).map((c, i) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="rounded-2xl border border-emerald-900/10 bg-white/80 px-4 py-5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--nm-leaf)]/40 hover:shadow-md"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <ProductRail title="New arrivals" products={home?.newArrivals ?? []} />
      <ProductRail title="Best sellers" products={home?.bestSellers ?? []} />

      <section className="mx-auto max-w-6xl px-4 py-14 nm-animate-in-delay">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: MapPin,
              title: 'Local stock & pricing',
              body: 'Switch branch once — catalogue, prices, and availability update to that store.',
            },
            {
              icon: Clock3,
              title: 'Click & collect',
              body: 'Order online and collect from your nearest Neighbourhood Market when ready.',
            },
            {
              icon: ShieldCheck,
              title: 'Secure checkout',
              body: 'Payments confirmed server-side. No browser-trusted prices at checkout.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-[var(--nm-mist)] p-6"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nm-forest)] text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductRail({
  title,
  products,
}: {
  title: string;
  products: Array<{
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    images: string[];
  }>;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-3xl font-semibold text-[var(--nm-ink)]">{title}</h2>
        <Link
          href="/products"
          className="text-sm font-semibold text-[var(--nm-forest)] hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
        {products.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-emerald-900/20 bg-white/50 px-4 py-10 text-center text-sm text-slate-500">
            No products yet — run seed data and select a branch.
          </p>
        )}
      </div>
    </section>
  );
}
