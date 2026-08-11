import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const siteUrl = process.env.APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Neighbourhood Market | Shop local drinks, snacks & essentials',
    template: '%s · Neighbourhood Market',
  },
  description:
    'Shop your local Neighbourhood Market branch for energy drinks, soft drinks, fresh fruit, snacks, and everyday essentials. Fast click & collect and secure checkout.',
  keywords: [
    'neighbourhood market',
    'local supermarket',
    'energy drinks',
    'soft drinks',
    'click and collect',
    'grocery delivery',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'Neighbourhood Market',
    title: 'Neighbourhood Market',
    description:
      'Light, fast local shopping — drinks, fruit, snacks, and essentials from your nearest branch.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Neighbourhood Market',
    description: 'Shop local branch stock with clear prices and secure checkout.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Neighbourhood Market',
    url: siteUrl,
    description:
      'Multi-branch neighbourhood grocery storefront with branch-aware pricing and stock.',
  };

  return (
    <html lang="en-GB" className={`${jakarta.variable} ${bricolage.variable}`}>
      <body className="min-h-screen bg-[var(--nm-canvas)] text-[var(--nm-ink)] antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
