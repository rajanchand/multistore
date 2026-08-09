import Link from 'next/link';
import Image from 'next/image';
import { formatMoney } from '@repo/types';

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
  };
}) {
  const src =
    Array.isArray(product.images) && product.images[0]
      ? product.images[0]
      : 'https://placehold.co/800x800/e7f4ef/0f7a63?text=Neighbourhood';
  const isRemote = src.startsWith('http');

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block transition duration-300 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--nm-soft)]">
        {isRemote ? (
          <Image
            src={src}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            unoptimized={src.includes('placehold.co') || src.startsWith('data:')}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={product.name} className="h-full w-full object-cover" />
        )}
        {product.salePrice != null && (
          <span className="absolute left-3 top-3 rounded-md bg-[var(--nm-highlight)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--nm-ink)]">
            Sale
          </span>
        )}
      </div>
      <div className="pt-3">
        <p className="font-semibold leading-snug text-[var(--nm-ink)]">{product.name}</p>
        <p className="mt-1.5 text-sm">
          {product.salePrice != null ? (
            <>
              <span className="font-semibold text-[var(--nm-accent)]">
                {formatMoney(product.salePrice)}
              </span>{' '}
              <span className="text-[var(--nm-muted)] line-through">{formatMoney(product.price)}</span>
            </>
          ) : (
            <span className="font-semibold text-[var(--nm-ink)]">{formatMoney(product.price)}</span>
          )}
        </p>
        {product.clickCollectEnabled !== false && (
          <p className="mt-1 text-xs text-[var(--nm-muted)]">Click &amp; collect</p>
        )}
      </div>
    </Link>
  );
}
