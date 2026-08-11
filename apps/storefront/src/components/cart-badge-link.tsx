'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';

export function CartBadgeLink({
  variant = 'header',
  className = '',
}: {
  variant?: 'header' | 'nav';
  className?: string;
}) {
  const { itemCount, bumpPulse } = useCart();
  const label =
    itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart';

  if (variant === 'nav') {
    return (
      <span className={`relative inline-flex ${className}`}>
        <ShoppingBag className="h-5 w-5" aria-hidden />
        {itemCount > 0 && (
          <span
            key={bumpPulse}
            className="nm-cart-badge absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--nm-accent)] px-1 text-[10px] font-bold leading-none text-white"
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Link
      href="/cart"
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--nm-line)] bg-[var(--nm-surface)] text-[var(--nm-ink)] shadow-sm transition hover:border-[var(--nm-accent)] hover:text-[var(--nm-accent)] ${className}`}
      aria-label={label}
    >
      <ShoppingBag className="h-4 w-4" />
      {itemCount > 0 && (
        <span
          key={bumpPulse}
          className="nm-cart-badge absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--nm-accent)] px-1 text-[11px] font-bold leading-none text-white shadow-sm"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}
