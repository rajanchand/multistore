/** Shared product image fallback when catalogue has no image URL. */
export const PRODUCT_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&h=800&q=80';

export function primaryProductImage(images?: string[] | null): string {
  if (Array.isArray(images) && images[0]) return images[0];
  return PRODUCT_IMAGE_FALLBACK;
}
