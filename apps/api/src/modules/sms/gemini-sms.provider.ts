export type SmsGenerateContext = {
  storeName: string;
  mode: 'single' | 'bulk';
  segment?: string;
  branchName?: string;
  campaignName?: string;
  campaignDescription?: string;
  campaignBodyHint?: string;
  offerName?: string;
  offerDescription?: string;
  offerSummary?: string;
  couponCode?: string;
  notes?: string;
};

export type SmsGenerateResult = {
  body: string;
  provider: 'gemini' | 'template';
  model?: string;
};

function buildPrompt(ctx: SmsGenerateContext): string {
  const lines = [
    `You write short marketing SMS for "${ctx.storeName}".`,
    'Rules:',
    '- Return ONLY the SMS text, no quotes or explanation.',
    '- Max 160 characters when possible; never exceed 320.',
    '- Friendly, clear UK English. No emoji spam (0–1 emoji max).',
    '- Include the offer/coupon if provided. Do not invent discount amounts.',
    '- Include a soft CTA (e.g. shop now / order today).',
    '',
    `Mode: ${ctx.mode}`,
  ];
  if (ctx.segment) lines.push(`Audience segment: ${ctx.segment.replace(/_/g, ' ')}`);
  if (ctx.branchName) lines.push(`Branch: ${ctx.branchName}`);
  if (ctx.campaignName) lines.push(`Campaign: ${ctx.campaignName}`);
  if (ctx.campaignDescription) lines.push(`Campaign description: ${ctx.campaignDescription}`);
  if (ctx.campaignBodyHint) lines.push(`Campaign draft copy: ${ctx.campaignBodyHint}`);
  if (ctx.offerName) lines.push(`Offer: ${ctx.offerName}`);
  if (ctx.offerDescription) lines.push(`Offer details: ${ctx.offerDescription}`);
  if (ctx.offerSummary) lines.push(`Offer terms: ${ctx.offerSummary}`);
  if (ctx.couponCode) lines.push(`Coupon code: ${ctx.couponCode}`);
  if (ctx.notes) lines.push(`Extra notes: ${ctx.notes}`);
  return lines.join('\n');
}

/** Deterministic fallback when GEMINI_API_KEY is missing or the API fails. */
export function templateSmsBody(ctx: SmsGenerateContext): string {
  const store = ctx.storeName || 'Our store';
  const branch = ctx.branchName ? ` at ${ctx.branchName}` : '';
  const offer = ctx.offerName || ctx.campaignName || 'a special offer';
  const code = ctx.couponCode ? ` Use code ${ctx.couponCode}.` : '';
  const detail = ctx.offerSummary ? ` ${ctx.offerSummary}.` : '';
  let body = `${store}${branch}: ${offer}.${detail}${code} Order today!`.replace(/\s+/g, ' ').trim();
  if (body.length > 320) body = body.slice(0, 317) + '...';
  return body;
}

/**
 * Google Gemini generateContent via REST.
 * Env: GEMINI_API_KEY (required for live AI), GEMINI_MODEL (optional).
 */
export async function generateSmsWithGemini(ctx: SmsGenerateContext): Promise<SmsGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = (process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash').replace(/^models\//, '');

  if (!apiKey) {
    return { body: templateSmsBody(ctx), provider: 'template' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = buildPrompt(ctx);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!res.ok) {
      return { body: templateSmsBody(ctx), provider: 'template' };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const body = raw
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 1600);

    if (!body) {
      return { body: templateSmsBody(ctx), provider: 'template' };
    }

    return { body, provider: 'gemini', model };
  } catch {
    return { body: templateSmsBody(ctx), provider: 'template' };
  }
}
