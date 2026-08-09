'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { BranchSelector } from './branch-selector';

const NAV = [
  { href: '/products', label: 'Shop' },
  { href: '/categories/energy-drinks', label: 'Categories' },
  { href: '/track-order', label: 'Track order' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/account', label: 'Account' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-[#f7faf8]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-900/10 text-[var(--nm-ink)] md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <Link href="/" className="font-display text-xl font-bold tracking-tight text-[var(--nm-ink)]">
          Neighbourhood<span className="text-[var(--nm-forest)]"> Market</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[var(--nm-forest)]">
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/search" className="ml-auto hidden max-w-xs flex-1 lg:block">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              placeholder="Search products…"
              className="h-10 w-full rounded-full border border-emerald-900/10 bg-white/80 pl-10 pr-3 text-sm outline-none ring-[var(--nm-leaf)]/30 placeholder:text-slate-400 focus:ring-2"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          <BranchSelector />
          <Link
            href="/account"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-emerald-900/10 text-slate-700 transition hover:bg-white sm:inline-flex"
            aria-label="Account"
          >
            <User className="h-4 w-4" />
          </Link>
          <Link
            href="/cart"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nm-forest)] text-white shadow-sm transition hover:bg-[var(--nm-leaf)]"
            aria-label="Cart"
          >
            <ShoppingBag className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {open && (
        <div className="border-t border-emerald-900/10 bg-white px-4 py-4 md:hidden">
          <form action="/search" className="mb-4">
            <input
              name="q"
              placeholder="Search products…"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </form>
          <nav className="flex flex-col gap-1 text-sm font-medium">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-slate-700 hover:bg-[var(--nm-mist)]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
