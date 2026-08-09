import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { formatMoney } from '@repo/types';
import { Badge } from '@repo/ui';
import { storeApi } from '@/lib/api';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { ProductGallery } from '@/components/product-gallery';

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  shortDescription: string | null;
  description: string | null;
  images: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  variants: Array<{
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
    isAvailable: boolean;
    stockLevel: string;
    isDefault: boolean;
    deliveryEnabled: boolean;
    clickCollectEnabled: boolean;
    images?: string[];
  }>;
}

async function loadProduct(slug: string) {
  const branchId = cookies().get('preferred_branch')?.value;
  const branches = await storeApi<Array<{ id: string }>>('/storefront/branches', {
    next: { revalidate: 45 },
  }).catch(() => []);
  const resolved = branchId ?? branches[0]?.id;
  if (!resolved) return null;
  return storeApi<ProductDetail>(`/storefront/products/${slug}?branchId=${resolved}`, {
    next: { revalidate: 45 },
  }).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await loadProduct(params.slug);
  if (!product) return { title: 'Product' };
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? undefined,
      images: Array.isArray(product.images) ? product.images.slice(0, 1) : [],
    },
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await loadProduct(params.slug);
  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-slate-600">
        Product not available at this branch.
      </div>
    );
  }
  const variant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const galleryImages = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(variant?.images && Array.isArray(variant.images) ? variant.images : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    brand: product.brand,
    image: galleryImages,
    offers: variant
      ? {
          '@type': 'Offer',
          priceCurrency: 'GBP',
          price: ((variant.salePrice ?? variant.price) / 100).toFixed(2),
          availability: variant.isAvailable
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        }
      : undefined,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={galleryImages} alt={product.name} />
        <div>
          <p className="text-sm font-medium text-[var(--nm-muted)]">{product.brand}</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--nm-ink)] sm:text-4xl">
            {product.name}
          </h1>
          {variant && (
            <p className="mt-4 text-2xl font-semibold text-[var(--nm-ink)]">
              {formatMoney(variant.salePrice ?? variant.price)}
              {variant.salePrice != null && (
                <span className="ml-2 text-base font-normal text-[var(--nm-muted)] line-through">
                  {formatMoney(variant.price)}
                </span>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={variant?.isAvailable ? 'success' : 'destructive'}>
              {variant?.stockLevel.replaceAll('_', ' ') ?? 'Unavailable'}
            </Badge>
            {variant?.deliveryEnabled && <Badge variant="secondary">Delivery</Badge>}
            {variant?.clickCollectEnabled && <Badge variant="secondary">Click & collect</Badge>}
          </div>
          <p className="mt-6 text-[var(--nm-muted)]">{product.shortDescription}</p>
          {variant && (
            <div className="mt-8">
              <AddToCartButton
                productId={product.id}
                variantId={variant.id}
                disabled={!variant.isAvailable}
              />
            </div>
          )}
          {product.variants.length > 1 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--nm-muted)]">
                Variants
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {product.variants.map((v) => (
                  <li
                    key={v.id}
                    className="flex justify-between border-b border-[var(--nm-line)] py-2.5"
                  >
                    <span>{v.name}</span>
                    <span className="font-medium">{formatMoney(v.salePrice ?? v.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {product.description && (
            <div className="mt-10 max-w-none text-sm">
              <h2 className="font-display text-2xl font-bold">Details</h2>
              <p className="mt-3 whitespace-pre-wrap text-[var(--nm-muted)]">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
