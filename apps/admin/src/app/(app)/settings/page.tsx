import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';

const SECTIONS = [
  {
    href: '/settings/store',
    title: '1. Store details',
    description: 'Brand name, legal entity, support contacts, address, VAT and company numbers.',
  },
  {
    href: '/settings/payment-methods',
    title: '2. Payment methods',
    description: 'Stripe, Apple Pay and Google Pay — enable methods and follow easy integration steps.',
  },
  {
    href: '/settings/delivery',
    title: '3. Delivery charges',
    description: 'Default delivery fee, free-delivery threshold, notes and estimated times.',
  },
  {
    href: '/settings/social',
    title: '4. Social account links',
    description: 'Facebook, Instagram, X, TikTok, YouTube and LinkedIn profile URLs.',
  },
  {
    href: '/settings/plugins',
    title: '5. Plugins & partners',
    description: 'WhatsApp chat, Facebook, and UK parcel partners (DPD, Evri, Royal Mail, Stuart…).',
  },
  {
    href: '/apps',
    title: '6. Apps (delivery marketplaces)',
    description: 'Uber Eats, Uber Direct, Deliveroo, Just Eat, DoorDash Drive, Getir — easy API setup.',
  },
  {
    href: '/settings/about',
    title: 'About content',
    description: 'Company and storefront about content sections.',
  },
  {
    href: '/settings/faqs',
    title: 'FAQs',
    description: 'Publish and organise frequently asked questions.',
  },
  {
    href: '/settings/staff',
    title: 'Staff',
    description: 'View HQ and branch staff accounts, roles, and branch assignments.',
  },
  {
    href: '/settings/branches',
    title: 'Branches',
    description: 'Review store locations and jump into branch management.',
  },
  {
    href: '/sessions',
    title: 'Login sessions',
    description: 'Review and revoke active admin login sessions.',
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Store, payments, delivery, social and plugins</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="block transition hover:opacity-90">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{section.description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>API URL: {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}</p>
          <p>Money is stored as integer minor units (pence). Never trust browser-supplied prices.</p>
          <p>
            Stripe secrets stay in env (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
            `STRIPE_WEBHOOK_SECRET`). Delivery partner API keys use env vars too.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
