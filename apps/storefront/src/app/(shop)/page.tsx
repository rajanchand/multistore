import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { ArrowRight, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { storeApi } from '@/lib/api';
import { HeroCarousel, type HeroSlide } from '@/components/hero-carousel';
import { ProductCard } from '@/components/product-card';
import { PRODUCT_IMAGE_FALLBACK } from '@/lib/product-image';

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

interface HomeProduct {
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  images: string[];
  inStock?: boolean;
  clickCollectEnabled?: boolean;
}

interface HomeData {
  banners: StorefrontBanner[];
  categories: Array<{ id: string; name: string; slug: string; image?: string | null }>;
  newArrivals: HomeProduct[];
  bestSellers: HomeProduct[];
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
    next: { revalidate: 45 },
  }).catch(() => []);
  return branches[0]?.id ?? null;
}

export default async function HomePage() {
  const branchId = await resolveBranchId();
  const [home, banners] = branchId
    ? await Promise.all([
        storeApi<HomeData>(`/storefront/home?branchId=${branchId}`, {
          next: { revalidate: 45 },
        }).catch(() => null),
        storeApi<StorefrontBanner[]>(`/storefront/banners?branchId=${branchId}`, {
          next: { revalidate: 45 },
        }).catch(() => [] as StorefrontBanner[]),
      ])
    : [null, [] as StorefrontBanner[]];

  const slides = toHeroSlides((home?.banners?.length ? home.banners : banners) ?? []);

  return (
    <div>
      <HeroCarousel slides={slides} />

      <section className="mx-auto max-w-6xl px-4 py-14 nm-animate-in">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-black sm:text-4xl">
              Popular categories
            </h2>
            <p className="mt-2 text-sm text-[var(--nm-muted)]">Jump straight to what you need.</p>
          </div>
          <Link
            href="/products"
            className="hidden items-center gap-1 text-sm font-semibold text-[var(--nm-accent)] sm:inline-flex"
          >
            Shop all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(home?.categories ?? []).slice(0, 8).map((c) => {
            const image = c.image || PRODUCT_IMAGE_FALLBACK;
            return (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="group overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--nm-line)] transition hover:ring-[var(--nm-accent)]/40"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--nm-soft)]">
                  <Image
                    src={image}
                    alt={c.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="font-semibold text-[var(--nm-ink)]">{c.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--nm-muted)]">Shop category</p>
                </div>
              </Link>
            );
          })}
          {(home?.categories ?? []).length === 0 && (
            <p className="col-span-full text-sm text-[var(--nm-muted)]">
              Categories will appear once a branch is selected.
            </p>
          )}
        </div>
      </section>

      <ProductRail title="New arrivals" products={home?.newArrivals ?? []} />
      <ProductRail title="Best sellers" products={home?.bestSellers ?? []} />

      <section className="mx-auto max-w-6xl px-4 py-16 nm-animate-in-delay">
        <h2 className="font-display text-3xl font-bold tracking-tight text-black">
          Why shop with us
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[var(--nm-muted)]">
          Local stock, clear pricing, and a checkout you can trust.
        </p>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
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
            <div key={title}>
              <Icon className="h-6 w-6 text-[var(--nm-accent)]" aria-hidden />
              <h3 className="mt-4 font-display text-xl font-bold text-[var(--nm-ink)]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--nm-muted)]">{body}</p>
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
  products: HomeProduct[];
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-bold tracking-tight text-black">{title}</h2>
        <Link
          href="/products"
          className="text-sm font-semibold text-[var(--nm-accent)] hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.slug}
            product={{
              ...p,
              inStock: p.inStock !== false,
            }}
          />
        ))}
        {products.length === 0 && (
          <p className="col-span-full border border-dashed border-[var(--nm-line)] bg-white px-4 py-12 text-center text-sm text-[var(--nm-muted)]">
            No products yet — run seed data and select a branch.
          </p>
        )}
      </div>
    </section>
  );
}
