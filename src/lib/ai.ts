import OpenAI from 'openai';

const AD_ANGLES = [
  { angle: 'offer-led', description: 'Lead with a compelling discount or offer' },
  { angle: 'ugc-style', description: 'User-generated content style, casual and authentic' },
  { angle: 'testimonial', description: 'Customer testimonial or social proof focused' },
  { angle: 'urgency', description: 'Create FOMO with limited time or stock urgency' },
  { angle: 'benefit-led', description: 'Highlight key product benefits and outcomes' },
  { angle: 'problem-solution', description: 'Address a pain point then present the solution' },
  { angle: 'lifestyle', description: 'Aspirational lifestyle imagery and copy' },
  { angle: 'comparison', description: 'Compare against alternatives or competitors' },
  { angle: 'founder-story', description: 'Personal founder/brand story angle' },
  { angle: 'social-proof', description: 'Numbers, reviews, and trust signals' },
];

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 MetaAdsBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const ogTitle = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    );
    return [
      ogTitle?.[1] || titleMatch?.[1] || '',
      descMatch?.[1] || '',
      h1Match?.[1] || '',
    ]
      .filter(Boolean)
      .join(' | ')
      .replace(/\s+/g, ' ')
      .slice(0, 500);
  } catch {
    return `Website: ${url}`;
  }
}

function extractBrand(websiteContent: string): { brand: string; hook: string } {
  const parts = websiteContent
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  const rawTitle = parts[0] || 'Your Brand';
  const brand = rawTitle
    .split(/[-–|·:]/)[0]
    .replace(/\b(official|store|shop|india|home)\b/gi, '')
    .trim()
    .slice(0, 40) || 'Your Brand';

  const hook = (parts[1] || parts[0] || 'premium products for everyday India')
    .replace(brand, '')
    .trim()
    .slice(0, 120) || 'quality products customers love';

  return { brand, hook };
}

/** Free offline ad copy — no API key or credits required */
export function generateFreeAdCopy(
  websiteContent: string,
  competitors: Array<{ url: string; type: string }> = []
): Array<{ variant_number: number; copy_text: string; angle: string }> {
  const { brand, hook } = extractBrand(websiteContent);
  const competitorHint =
    competitors.find((c) => c.type === 'website')?.url ||
    competitors[0]?.url ||
    null;
  const competitorHost = competitorHint
    ? competitorHint.replace(/^https?:\/\//, '').split('/')[0]
    : null;

  const templates: Record<string, string> = {
    'offer-led': `🔥 ${brand} sale is ON! Get exclusive deals on ${hook}. Shop now & save big — limited-time offer for India! 🛍️`,
    'ugc-style': `Okay but why did nobody tell me about ${brand} earlier? 😭 Just ordered — ${hook}. Linking it before it sells out 👀`,
    'testimonial': `"Switched to ${brand} and I'm never going back." Real customers. Real results. ${hook} — join thousands of happy shoppers across India ⭐`,
    'urgency': `⏰ Last chance! ${brand} stock is moving fast. ${hook}. Order today — tomorrow might be too late.`,
    'benefit-led': `Why ${brand}? Because ${hook}. Better quality, fair prices, and delivery across India. Upgrade your everyday essentials today.`,
    'problem-solution': `Tired of average products that don't last? ${brand} fixes that. ${hook}. One switch. Better results.`,
    'lifestyle': `Your lifestyle upgrade starts with ${brand}. ${hook}. Made for modern India — look good, feel better ✨`,
    'comparison': competitorHost
      ? `Looking past ${competitorHost}? Smart move. ${brand} brings ${hook} — without the hype tax. Compare and choose better.`
      : `Don't settle for copycats. ${brand} delivers ${hook}. See the difference for yourself.`,
    'founder-story': `Built for Indian homes, by people who get it. ${brand} started with one idea: ${hook}. Now it's your turn to try it.`,
    'social-proof': `Trusted by shoppers across India 🇮🇳 ${brand} — ${hook}. Rated highly. Reordered often. Join the community.`,
  };

  return AD_ANGLES.map((a, i) => ({
    variant_number: i + 1,
    copy_text: templates[a.angle] || `${brand}: ${hook}`,
    angle: a.angle,
  }));
}

async function generateWithGroq(
  websiteContent: string,
  competitors: Array<{ url: string; type: string }>
): Promise<Array<{ variant_number: number; copy_text: string; angle: string }> | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const competitorBlock =
    competitors.length > 0
      ? `Competitors:\n${competitors.map((c, i) => `${i + 1}. (${c.type}) ${c.url}`).join('\n')}`
      : '';

  const prompt = `You are an expert Meta ads copywriter for D2C brands in India.
Website info: ${websiteContent}
${competitorBlock}
Generate exactly 10 ad variants as JSON: {"variants":[{"variant_number":1,"copy_text":"...","angle":"offer-led"}, ...]}
Angles: ${AD_ANGLES.map((a) => a.angle).join(', ')}. Each copy 2-3 sentences, Indian audience, emojis ok.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  const variants = parsed.variants || parsed.ads || [];
  return Array.isArray(variants) && variants.length > 0 ? variants : null;
}

export async function generateAdCopy(
  websiteContent: string,
  competitors: Array<{ url: string; type: string }> = []
): Promise<Array<{ variant_number: number; copy_text: string; angle: string }>> {
  // 1) Optional paid OpenAI — only if key works; fall back on billing errors
  const openai = getOpenAI();
  if (openai) {
    try {
      const competitorBlock =
        competitors.length > 0
          ? `Competitors:\n${competitors.map((c, i) => `${i + 1}. (${c.type}) ${c.url}`).join('\n')}`
          : '';

      const prompt = `You are an expert Meta (Facebook/Instagram) ads copywriter for D2C Shopify brands in India.

Website info: ${websiteContent}
${competitorBlock}

Generate exactly 10 ad copy variants, one for each angle:
${AD_ANGLES.map((a, i) => `${i + 1}. ${a.angle}: ${a.description}`).join('\n')}

Each variant should be 2-3 sentences, include emojis where appropriate, and be optimized for Indian D2C audiences. Return JSON: {"variants":[{ "variant_number": number, "copy_text": string, "angle": string }]}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      const variants = parsed.variants || parsed.ads || Object.values(parsed)[0] || [];
      if (Array.isArray(variants) && variants.length > 0) return variants;
    } catch (err) {
      console.warn('[AI] OpenAI failed, using free generator:', err);
    }
  }

  // 2) Optional free Groq tier (no card needed for free quota)
  try {
    const groq = await generateWithGroq(websiteContent, competitors);
    if (groq) return groq;
  } catch (err) {
    console.warn('[AI] Groq failed, using free generator:', err);
  }

  // 3) Always-available free offline generator
  return generateFreeAdCopy(websiteContent, competitors);
}

export async function generateAdImage(
  copyText: string,
  angle: string,
  variantNumber: number,
  brandHint?: string
): Promise<string> {
  // Free by default — skip paid DALL·E unless explicitly enabled
  if (process.env.OPENAI_API_KEY && process.env.USE_OPENAI_IMAGES === 'true') {
    const openai = getOpenAI();
    if (openai) {
      try {
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `Professional Meta/Facebook ad creative for a D2C e-commerce brand in India. Style: ${angle}. Context: ${copyText.slice(0, 200)}. Clean, modern, mobile-optimized square format.`,
          n: 1,
          size: '1024x1024',
        });
        if (response.data?.[0]?.url) return response.data[0].url;
      } catch {
        // fall through to free placeholder
      }
    }
  }

  return getPlaceholderImage(variantNumber, angle, brandHint || copyText);
}

function getPlaceholderImage(
  variantNumber: number,
  angle: string,
  labelSource?: string
): string {
  const colors = [
    '6366f1',
    '8b5cf6',
    'ec4899',
    'f59e0b',
    '10b981',
    '3b82f6',
    'ef4444',
    '14b8a6',
    'f97316',
    'a855f7',
  ];
  const color = colors[(variantNumber - 1) % colors.length];
  const brandBit = (labelSource || '')
    .split(/[.!?\n]/)[0]
    .replace(/[^\w\s&]/g, '')
    .trim()
    .slice(0, 18);
  const text = encodeURIComponent(
    brandBit || angle.replace(/-/g, ' ').slice(0, 20)
  );
  return `https://placehold.co/600x600/${color}/ffffff/png?text=${text}&font=montserrat`;
}

export { AD_ANGLES };
