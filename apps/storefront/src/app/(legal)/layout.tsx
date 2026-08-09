import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--nm-line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/select-location" className="font-display text-lg font-bold text-[var(--nm-ink)]">
            Neighbourhood<span className="text-[var(--nm-accent)]"> Market</span>
          </Link>
          <Link href="/select-location" className="text-sm font-semibold text-[var(--nm-accent)]">
            Choose store
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
