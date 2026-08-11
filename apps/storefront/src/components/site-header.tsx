'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, Search, User, X } from 'lucide-react';
import { BranchSelector } from './branch-selector';
import { CartBadgeLink } from './cart-badge-link';

const NAV = [
  { href: '/products', label: 'Shop' },
  { href: '/categories/energy-drinks', label: 'Categories' },
  { href: '/cart', label: 'Cart' },
  { href: '/account', label: 'Account' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/track-order', label: 'Track order' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--nm-line)] bg-[var(--nm-surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--nm-line)] text-[var(--nm-ink)] transition hover:bg-[var(--nm-soft)] md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link
          href="/"
          className="font-display text-[1.35rem] font-bold leading-none tracking-tight text-[var(--nm-ink)]"
        >
          Neighbourhood <span className="text-[var(--nm-accent)]">Market</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 text-sm font-semibold text-[var(--nm-ink)] lg:flex">
          {NAV.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 transition hover:bg-[var(--nm-soft)] hover:text-[var(--nm-accent)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nm-muted)]" />
            <input
              name="q"
              placeholder="Search products…"
              className="h-11 w-full rounded-xl border border-[var(--nm-line)] bg-white pl-10 pr-3 text-sm text-[var(--nm-ink)] outline-none ring-[var(--nm-accent)]/25 placeholder:text-[var(--nm-muted)] focus:ring-2"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          <BranchSelector />
          <Link
            href="/account"
            className="hidden h-11 w-11 items-center justify-center rounded-xl border border-[var(--nm-line)] text-[var(--nm-ink)] transition hover:bg-[var(--nm-soft)] sm:inline-flex"
            aria-label="Account"
          >
            <User className="h-4 w-4" />
          </Link>
          <CartBadgeLink />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 top-16 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-[var(--nm-line)] bg-white px-4 py-5 shadow-lg">
            <form action="/search" className="mb-4">
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nm-muted)]" />
                <input
                  name="q"
                  placeholder="Search products…"
                  className="h-12 w-full rounded-xl border border-[var(--nm-line)] bg-white pl-10 pr-3 text-base text-[var(--nm-ink)] outline-none focus:ring-2 focus:ring-[var(--nm-accent)]/30"
                />
              </label>
            </form>
            <nav className="flex flex-col gap-1 text-base font-semibold">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="min-h-[48px] rounded-xl px-3 py-3 text-[var(--nm-ink)] hover:bg-[var(--nm-soft)]"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-[var(--nm-line)] pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--nm-muted)]">
                Your store
              </p>
              <BranchSelector />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
