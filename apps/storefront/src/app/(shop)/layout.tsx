import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CategoriesBar } from '@/components/categories-bar';
import { PromoRibbon } from '@/components/promo-ribbon';
import { ChatPlugins } from '@/components/chat-plugins';
import { MobileNav } from '@/components/mobile-nav';
import { CartProvider } from '@/lib/cart-context';
import { getPublicSettings } from '@/lib/public-settings';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();
  const chatPlugins = (settings?.plugins ?? []).filter(
    (p) => p.category === 'chat' || p.category === 'social',
  );

  return (
    <CartProvider>
      <PromoRibbon />
      <SiteHeader />
      <CategoriesBar />
      <main className="nm-main">{children}</main>
      <SiteFooter />
      <MobileNav />
      <ChatPlugins plugins={chatPlugins} />
    </CartProvider>
  );
}
