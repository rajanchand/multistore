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
    <footer className="mt-20 border-t border-emerald-900/10 bg-[var(--nm-ink)] text-emerald-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl font-semibold">{storeName}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-100/75">{tagline}</p>
          {settings?.delivery?.deliveryNotes && (
            <p className="mt-4 max-w-md text-xs text-emerald-100/60">
              Delivery: {settings.delivery.estimatedDeliveryHours ?? 'See checkout'} —{' '}
              {settings.delivery.deliveryNotes}
            </p>
          )}
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Help</p>
          <ul className="mt-3 space-y-2 text-emerald-100/75">
            <li>
              <Link href="/faq" className="hover:text-white">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/returns" className="hover:text-white">
                Returns
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-white">
                Track order
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">
            {socialEntries.length ? 'Social' : 'Legal'}
          </p>
          <ul className="mt-3 space-y-2 text-emerald-100/75">
            {socialEntries.map(([key, url]) => (
              <li key={key}>
                <a href={url} target="_blank" rel="noreferrer" className="hover:text-white">
                  {SOCIAL_LABELS[key] ?? key}
                </a>
              </li>
            ))}
            <li>
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-emerald-100/50">
        © {new Date().getFullYear()} {storeName}
      </div>
    </footer>
  );
}
