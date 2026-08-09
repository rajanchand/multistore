import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-emerald-900/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/select-location" className="font-display text-lg font-bold text-[var(--nm-ink)]">
            Neighbourhood<span className="text-[var(--nm-forest)]"> Market</span>
          </Link>
          <Link href="/select-location" className="text-sm font-medium text-[var(--nm-forest)]">
            Choose store
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
