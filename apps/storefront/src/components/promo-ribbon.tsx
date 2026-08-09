import Link from 'next/link';
import { cookies } from 'next/headers';
import { Megaphone } from 'lucide-react';
import { storeApi } from '@/lib/api';

interface Banner {
  id: string;
  title: string;
  type: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

export async function PromoRibbon() {
  const branchId = cookies().get('preferred_branch')?.value;
  const banners = await storeApi<Banner[]>(
    branchId ? `/storefront/banners?branchId=${branchId}` : '/storefront/banners',
    { cache: 'no-store' },
  ).catch(() => [] as Banner[]);

  const promo =
    banners.find((b) => b.type === 'ANNOUNCEMENT' || b.type === 'PROMOTION') ??
    banners.find((b) => b.type === 'POPUP');

  if (!promo) {
    return (
      <div className="bg-[var(--nm-ink)] text-center text-xs text-emerald-50">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2">
          <Megaphone className="h-3.5 w-3.5 text-[var(--nm-amber)]" />
          <span>Free click &amp; collect at your local branch · Same-day when you order before 2pm</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--nm-ink)] text-center text-xs text-emerald-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2">
        <Megaphone className="h-3.5 w-3.5 text-[var(--nm-amber)]" />
        <span className="font-medium">{promo.title}</span>
        {promo.body && <span className="opacity-80">· {promo.body}</span>}
        {promo.ctaUrl && (
          <Link href={promo.ctaUrl} className="underline decoration-[var(--nm-amber)] underline-offset-2">
            {promo.ctaLabel ?? 'Shop now'}
          </Link>
        )}
      </div>
    </div>
  );
}
