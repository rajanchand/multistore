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
      : 'https://placehold.co/800x800/e8f2ec/1f6b4a?text=Neighbourhood';
  const isRemote = src.startsWith('http');

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-2xl border border-emerald-900/10 bg-white/90 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--nm-mist)]">
        {isRemote ? (
          <Image
            src={src}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
            unoptimized={src.includes('placehold.co') || src.startsWith('data:')}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={product.name} className="h-full w-full object-cover" />
        )}
        {product.salePrice != null && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--nm-amber)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Sale
          </span>
        )}
        {product.clickCollectEnabled !== false && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--nm-forest)] backdrop-blur">
            Click & collect
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-medium leading-snug text-[var(--nm-ink)]">{product.name}</p>
        <p className="mt-2 text-sm">
          {product.salePrice != null ? (
            <>
              <span className="font-semibold text-[var(--nm-forest)]">
                {formatMoney(product.salePrice)}
              </span>{' '}
              <span className="text-slate-400 line-through">{formatMoney(product.price)}</span>
            </>
          ) : (
            <span className="font-semibold">{formatMoney(product.price)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
