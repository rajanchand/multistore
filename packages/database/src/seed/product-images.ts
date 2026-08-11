/**
 * HD catalogue imagery keyed by product slug.
 * Prefer clear packshots / food photography (Open Food Facts + Unsplash).
 * When GEMINI_API_KEY is set, `enrich:images` can replace these with AI packshots.
 */

/** Square HD crop — high quality for storefront cards. */
const u = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${w}&q=90`;

const u2 = (id: string) => u(id, 1200);

/** Open Food Facts front image (prefer .full for sharper storefront cards). */
const off = (path: string) =>
  `https://images.openfoodfacts.org/images/products/${path}`.replace(/\.400\.jpg$/i, '.full.jpg');

export const PRODUCT_IMAGES: Record<string, string[]> = {
  // ——— Fruits (clear produce photography) ———
  'bananas-1kg': [u('photo-1571771894821-ce9b6c11b08e'), u2('photo-1603833665858-e61d17a86224')],
  'gala-apples-6-pack': [u('photo-1560806887-1e4cd0b6cbd6'), u2('photo-1570913149827-d2ac84ab3f9a')],
  'oranges-net-1kg': [u('photo-1547514701-42782101795e'), u2('photo-1611080626919-7cf5a9dbab5b')],
  'strawberries-400g': [u('photo-1464965911861-746a04b4bca6'), u2('photo-1519996529931-28324d5a630e')],
  'seedless-grapes-500g': [u('photo-1537640538966-79f369143f8f'), u2('photo-1596363505729-4190a9506133')],
  'blueberries-150g': [u('photo-1498557850523-fd3d118b962e'), u2('photo-1502741338009-cac2772e18bc')],

  // ——— Vegetables ———
  'tomatoes-vine-6-pack': [u('photo-1518977956812-cd3dbadaaf31'), u2('photo-1607305387299-a3d9611cd469')],
  'cucumber-each': [u('photo-1576045057995-568f588f82fb'), u2('photo-1566385101042-1a0aa0c1268c')],
  'carrots-1kg': [u('photo-1598170845058-32b9d6a5da37'), u2('photo-1594282486552-05b4d80fbb9f')],

  // ——— Energy drinks (brand packshots) ———
  'monster-energy-original-500ml': [
    off('506/033/750/0401/front_de.56.400.jpg'),
    u('photo-1551024709-8f23befc6f87'),
  ],
  'monster-energy-ultra-500ml': [
    off('506/033/750/0401/front_de.56.400.jpg'),
    u('photo-1613478223719-2ab802602423'),
  ],
  'red-bull-energy-drink-250ml': [
    off('900/249/010/0070/front_en.245.400.jpg'),
    u('photo-1613478223719-2ab802602423'),
  ],
  'red-bull-sugarfree-250ml': [
    off('900/249/010/0070/front_en.245.400.jpg'),
    u('photo-1551024709-8f23befc6f87'),
  ],
  'lucozade-energy-original-380ml': [
    off('505/426/700/0612/front_en.53.400.jpg'),
    u('photo-1551024709-8f23befc6f87'),
  ],

  // ——— Soft drinks ———
  'coca-cola-original-330ml': [
    off('544/900/000/0996/front_en.1107.400.jpg'),
    u('photo-1554866585-cd94860890b7'),
  ],
  'coca-cola-zero-sugar-330ml': [
    off('544/900/005/4227/front_en.543.400.jpg'),
    u('photo-1622483767028-3f66f32aef97'),
  ],
  'fanta-orange-330ml': [u('photo-1625772299848-391b6a87d7b3'), u2('photo-1527960471264-932f39eb5846')],
  'sprite-lemon-lime-330ml': [
    off('544/900/001/5105/front_fr.4.400.jpg'),
    u('photo-1625772299848-391b6a87d7b3'),
  ],
  'irn-bru-330ml': [u('photo-1581006852262-e4307cf6283a'), u2('photo-1527960471264-932f39eb5846')],
  'pepsi-max-330ml': [u('photo-1629203851122-3726ecdf080e'), u2('photo-1554866585-cd94860890b7')],
  'ribena-blackcurrant-500ml': [
    u('photo-1622597467836-f3285f2131b8'),
    u2('photo-1581006852262-e4307cf6283a'),
  ],
  '7up-free-330ml': [u('photo-1625772299848-391b6a87d7b3'), u2('photo-1527960471264-932f39eb5846')],
  'dr-pepper-330ml': [u('photo-1622483767028-3f66f32aef97'), u2('photo-1554866585-cd94860890b7')],

  // ——— Water & juice ———
  'evian-water-500ml': [off('306/832/012/0256/front_en.61.400.jpg'), u('photo-1548839140-29a749e1cf4d')],
  'tropicana-orange-juice-1l': [
    off('350/211/000/9449/front_en.151.400.jpg'),
    u('photo-1610889556528-9a770e32642f'),
  ],

  // ——— Crisps & snacks ———
  'walkers-cheese-onion-32g': [
    off('000/005/100/0005/front_en.57.400.jpg'),
    u('photo-1515003197210-e0cd71810b5f'),
  ],
  'walkers-ready-salted-32g': [
    u('photo-1599490659213-e2b9527bd087'),
    u2('photo-1576186726115-4d51596775d1'),
  ],
  'doritos-chilli-heatwave-150g': [
    off('316/893/017/3199/front_fr.42.400.jpg'),
    u('photo-1515003197210-e0cd71810b5f'),
  ],
  'pringles-original-165g': [
    u('photo-1576186726115-4d51596775d1'),
    u2('photo-1599490659213-e2b9527bd087'),
  ],

  // ——— Confectionery ———
  'cadbury-dairy-milk-110g': [u('photo-1511381939415-e44015466834'), u2('photo-1608248543803-ba4f8c70ae0b')],
  'cadbury-twirl': [u('photo-1511381939415-e44015466834'), u2('photo-1558961363-fa8fdf82db35')],
  'haribo-starmix-160g': [
    off('501/203/592/7592/front_en.62.400.jpg'),
    u('photo-1582058091505-f87a2e55a40f'),
  ],
  'skittles-fruits-136g': [u('photo-1582058091505-f87a2e55a40f'), u2('photo-1464965911861-746a04b4bca6')],

  // ——— Biscuits & cakes ———
  'mcvities-digestives-400g': [
    off('500/016/803/6755/front_en.72.400.jpg'),
    u('photo-1558961363-fa8fdf82db35'),
  ],
  'oreo-original-154g': [u('photo-1499636136210-6f4ee915583e'), u2('photo-1486427944299-d1955d23e34d')],

  // ——— Household ———
  'fairy-original-433ml': [
    off('408/450/090/0509/front_en.9.400.jpg'),
    u('photo-1583947215259-38e31be8751f'),
  ],
  'andrex-classic-4-pack': [u('photo-1584622650111-993a426fbf0a'), u2('photo-1628177142898-93e36e4e3a50')],
  'flash-multi-surface-500ml': [
    u('photo-1563453392212-326f5e854473'),
    u2('photo-1556912173-46c336c7fd55'),
  ],

  // ——— Health & beauty ———
  'colgate-total-100ml': [u('photo-1556228578-0d85b1a4d571'), u2('photo-1608248543803-ba4f8c70ae0b')],
  'dove-beauty-bar-2pk': [u('photo-1556228578-0d85b1a4d571'), u2('photo-1608248543803-ba4f8c70ae0b')],
  'lynx-africa-150ml': [u('photo-1608248543803-ba4f8c70ae0b'), u2('photo-1556228578-0d85b1a4d571')],

  // Merch
  'store-logo-t-shirt': [u('photo-1521572163474-6864f9cf17ab'), u2('photo-1583743814966-8936f5b7be1a')],
};

export const CATEGORY_IMAGES: Record<string, string> = {
  fruits: u('photo-1610832958506-aa56368176cf', 1200),
  vegetables: u('photo-1540420773420-3366772f4999', 1200),
  'energy-drinks': u('photo-1551024709-8f23befc6f87', 1200),
  'soft-drinks': u('photo-1554866585-cd94860890b7', 1200),
  'water-juice': u('photo-1610889556528-9a770e32642f', 1200),
  'crisps-snacks': u('photo-1515003197210-e0cd71810b5f', 1200),
  confectionery: u('photo-1511381939415-e44015466834', 1200),
  'biscuits-cakes': u('photo-1558961363-fa8fdf82db35', 1200),
  household: u('photo-1583947215259-38e31be8751f', 1200),
  'health-beauty': u('photo-1556228578-0d85b1a4d571', 1200),
};

export function imagesForProduct(slug: string, fallbackSeed: string): string[] {
  const mapped = PRODUCT_IMAGES[slug];
  if (mapped?.length) return mapped;
  const seed = encodeURIComponent(fallbackSeed);
  return [
    `https://picsum.photos/seed/${seed}/1400/1400`,
    `https://picsum.photos/seed/${seed}-b/1400/1400`,
  ];
}

/** Prompt used by Gemini image enrichment for a catalogue SKU. */
export function geminiProductImagePrompt(name: string, brand: string, categoryHint?: string): string {
  const cat = categoryHint ? `, ${categoryHint} category` : '';
  return [
    `Professional e-commerce product photography of "${name}" by ${brand}${cat}.`,
    'Single product centered on a clean white seamless studio background.',
    'Sharp focus, natural colours, soft studio lighting, high detail, 1:1 square framing.',
    'Photorealistic packshot suitable for an online grocery store. No text overlays, no invented logos, no watermark, no hands.',
  ].join(' ');
}
