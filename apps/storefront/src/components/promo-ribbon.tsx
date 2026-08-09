import Link from 'next/link';
import { cookies } from 'next/headers';
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
    { next: { revalidate: 45 } },
  ).catch(() => [] as Banner[]);

  const promo =
    banners.find((b) => b.type === 'ANNOUNCEMENT' || b.type === 'PROMOTION') ??
    banners.find((b) => b.type === 'POPUP');

  if (!promo) {
    return (
      <div className="border-b border-[var(--nm-line)] bg-[var(--nm-soft)] text-center text-xs text-[var(--nm-ink)]">
        <div className="mx-auto max-w-6xl px-4 py-2.5 font-medium">
          Free click &amp; collect at your local branch · Same-day when you order before 2pm
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--nm-line)] bg-[var(--nm-soft)] text-center text-xs text-[var(--nm-ink)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2.5">
        <span className="font-semibold">{promo.title}</span>
        {promo.body && <span className="text-[var(--nm-muted)]">· {promo.body}</span>}
        {promo.ctaUrl && (
          <Link
            href={promo.ctaUrl}
            className="font-semibold text-[var(--nm-accent)] underline-offset-2 hover:underline"
          >
            {promo.ctaLabel ?? 'Shop now'}
          </Link>
        )}
      </div>
    </div>
  );
}
