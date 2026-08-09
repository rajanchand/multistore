import Link from 'next/link';
import { getPublicSettings } from '@/lib/public-settings';

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

export async function SiteFooter() {
  const settings = await getPublicSettings();
  const storeName = settings?.store?.storeName ?? 'Neighbourhood Market';
  const tagline =
    settings?.store?.tagline ??
    'Multi-branch convenience with local pricing, live stock, and collection options.';
  const social = settings?.social ?? {};
  const socialEntries = Object.entries(social).filter(([, url]) => Boolean(url));

  return (
    <footer className="mt-16 border-t border-[var(--nm-line)] bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl font-bold tracking-tight text-[var(--nm-ink)]">
            {storeName}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--nm-muted)]">{tagline}</p>
          {settings?.delivery?.deliveryNotes && (
            <p className="mt-4 max-w-md text-xs text-[var(--nm-muted)]">
              Delivery: {settings.delivery.estimatedDeliveryHours ?? 'See checkout'} —{' '}
              {settings.delivery.deliveryNotes}
            </p>
          )}
        </div>
        <div className="text-sm">
          <p className="font-semibold text-[var(--nm-ink)]">Help</p>
          <ul className="mt-3 space-y-2.5 text-[var(--nm-muted)]">
            <li>
              <Link href="/faq" className="hover:text-[var(--nm-accent)]">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/returns" className="hover:text-[var(--nm-accent)]">
                Returns
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[var(--nm-accent)]">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-[var(--nm-accent)]">
                Track order
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-[var(--nm-ink)]">
            {socialEntries.length ? 'Social' : 'Legal'}
          </p>
          <ul className="mt-3 space-y-2.5 text-[var(--nm-muted)]">
            {socialEntries.map(([key, url]) => (
              <li key={key}>
                <a href={url} target="_blank" rel="noreferrer" className="hover:text-[var(--nm-accent)]">
                  {SOCIAL_LABELS[key] ?? key}
                </a>
              </li>
            ))}
            <li>
              <Link href="/privacy" className="hover:text-[var(--nm-accent)]">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-[var(--nm-accent)]">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--nm-line)] py-4 text-center text-xs text-[var(--nm-muted)]">
        © {new Date().getFullYear()} {storeName}
      </div>
    </footer>
  );
}
