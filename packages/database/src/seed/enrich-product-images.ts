/**
 * Enrich product images with Google Gemini image generation.
 *
 * Usage:
 *   GEMINI_API_KEY=... pnpm --filter @repo/database enrich:images
 *
 * Writes packshots to apps/storefront/public/product-images/{slug}.png
 * and updates Product.images in the database to point at them.
 *
 * Model: GEMINI_IMAGE_MODEL (default gemini-2.5-flash-image).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { geminiProductImagePrompt } from './product-images';

const prisma = new PrismaClient();

const MODEL = (process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image').replace(
  /^models\//,
  '',
);
const STOREFRONT_PUBLIC =
  process.env.STOREFRONT_PUBLIC_DIR?.trim() ||
  path.resolve(__dirname, '../../../../apps/storefront/public/product-images');
const PUBLIC_BASE =
  process.env.STOREFRONT_PUBLIC_URL?.replace(/\/$/, '') || 'http://localhost:3000';

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

async function generateImagePng(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to generate product images.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Gemini ${res.status}: ${body.slice(0, 400)}`);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    const b64 = inline?.data;
    if (!b64) continue;
    return Buffer.from(b64, 'base64');
  }
  return null;
}

async function main() {
  const limit = Number(process.env.ENRICH_IMAGE_LIMIT ?? '0') || 0;
  await mkdir(STOREFRONT_PUBLIC, { recursive: true });

  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      brand: true,
      categories: { include: { category: { select: { name: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const targets = limit > 0 ? products.slice(0, limit) : products;
  console.log(`Generating Gemini images for ${targets.length} products (model=${MODEL})…`);

  let ok = 0;
  let fail = 0;
  for (const product of targets) {
    const categoryHint = product.categories.map((c) => c.category.name).join(', ');
    const prompt = geminiProductImagePrompt(
      product.name,
      product.brand ?? 'Own Brand',
      categoryHint || undefined,
    );
    process.stdout.write(`- ${product.slug}… `);
    try {
      const buf = await generateImagePng(prompt);
      if (!buf) {
        console.log('no image in response');
        fail += 1;
        continue;
      }
      const file = `${product.slug}.png`;
      const abs = path.join(STOREFRONT_PUBLIC, file);
      await writeFile(abs, buf);
      const url = `${PUBLIC_BASE}/product-images/${file}`;
      const secondary = `${PUBLIC_BASE}/product-images/${file}`;
      await prisma.product.update({
        where: { id: product.id },
        data: { images: [url, secondary] },
      });
      console.log(`ok (${Math.round(buf.length / 1024)}KB)`);
      ok += 1;
      // Gentle rate limit for free-tier keys
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.log(`fail: ${err instanceof Error ? err.message : String(err)}`);
      fail += 1;
    }
  }

  console.log(`Done. ${ok} generated, ${fail} failed. Files in ${STOREFRONT_PUBLIC}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
