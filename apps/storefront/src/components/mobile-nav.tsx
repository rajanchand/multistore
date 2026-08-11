'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, User } from 'lucide-react';
import { CartBadgeLink } from './cart-badge-link';
import { useCart } from '@/lib/cart-context';

const ITEMS = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  {
    href: '/products',
    label: 'Shop',
    icon: LayoutGrid,
    match: (p: string) => p.startsWith('/products') || p.startsWith('/categories'),
  },
  { href: '/cart', label: 'Cart', icon: 'cart' as const, match: (p: string) => p.startsWith('/cart') },
  {
    href: '/account',
    label: 'Account',
    icon: User,
    match: (p: string) => p.startsWith('/account') || p.startsWith('/track-order'),
  },
];

export function MobileNav() {
  const pathname = usePathname() ?? '/';
  const { itemCount } = useCart();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--nm-line)] bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={
                  href === '/cart' && itemCount > 0
                    ? `Cart, ${itemCount} items`
                    : label
                }
                className={[
                  'flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition',
                  active ? 'text-[var(--nm-accent)]' : 'text-[var(--nm-ink)]',
                ].join(' ')}
              >
                {Icon === 'cart' ? (
                  <CartBadgeLink variant="nav" />
                ) : (
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
