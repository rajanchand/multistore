import { storeApi } from './api';

export type PublicSettings = {
  store: {
    storeName?: string;
    tagline?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  social: Record<string, string | undefined>;
  delivery: {
    defaultDeliveryFee?: number;
    defaultFreeDeliveryThreshold?: number | null;
    deliveryNotes?: string;
    estimatedDeliveryHours?: string;
  };
  plugins: Array<{
    code: string;
    name: string;
    category: string;
    provider: string;
    config: Record<string, unknown> | null;
  }>;
  paymentMethods: Array<{ code: string; name: string; provider: string }>;
};

export async function getPublicSettings(): Promise<PublicSettings | null> {
  try {
    return await storeApi<PublicSettings>('/storefront/settings', {
      // Next.js fetch cache hint
      ...({ next: { revalidate: 60 } } as object),
    });
  } catch {
    return null;
  }
}
