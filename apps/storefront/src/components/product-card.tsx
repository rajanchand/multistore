import Link from 'next/link';
import Image from 'next/image';
import { formatMoney } from '@repo/types';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { primaryProductImage } from '@/lib/product-image';

export function ProductCard({
  product,
}: {
  product: {
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    images: string[];
    clickCollectEnabled?: boolean;
    productId?: string;
    variantId?: string;
    inStock?: boolean;
  };
}) {
  const src = primaryProductImage(product.images);
  const isRemote = src.startsWith('http');
  const canQuickAdd = Boolean(product.productId && product.variantId && product.inStock !== false);

  return (
    <article className="group flex h-full flex-col nm-card-lift">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--nm-line)]">
          {isRemote ? (
            <Image
              src={src}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-contain p-3 transition duration-500 ease-out group-hover:scale-[1.03]"
              unoptimized={src.startsWith('data:')}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={product.name}
              className="h-full w-full object-contain p-3"
            />
          )}
          {product.salePrice != null && (
            <span className="absolute left-3 top-3 rounded-md bg-[var(--nm-highlight)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
              Sale
            </span>
          )}
          {product.inStock === false && (
            <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Out of stock
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <Link href={`/products/${product.slug}`} className="block">
          <h3 className="font-semibold leading-snug text-[var(--nm-ink)] transition group-hover:text-black">
            {product.name}
          </h3>
          <p className="mt-1.5 text-sm">
            {product.salePrice != null ? (
              <>
                <span className="font-bold text-black">{formatMoney(product.salePrice)}</span>{' '}
                <span className="text-[var(--nm-muted)] line-through">{formatMoney(product.price)}</span>
              </>
            ) : (
              <span className="font-bold text-black">{formatMoney(product.price)}</span>
            )}
          </p>
          {product.clickCollectEnabled !== false && (
            <p className="mt-1 text-xs text-[var(--nm-muted)]">Click &amp; collect</p>
          )}
        </Link>
        {canQuickAdd && (
          <div className="mt-auto pt-3">
            <AddToCartButton
              compact
              productId={product.productId!}
              variantId={product.variantId!}
            />
          </div>
        )}
      </div>
    </article>
  );
}
