/** Brand DNA extraction from website / catalog signals (pure; fetch optional). */

export type BrandDnaInput = {
  brandName?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  pageTitle?: string | null;
  h1?: string | null;
  bodyText?: string | null;
  colors?: string[] | null;
  logoUrl?: string | null;
  existingVoice?: string | null;
  existingValues?: string[] | null;
  category?: string | null;
};

export type BrandDnaProfile = {
  brand_name: string;
  website_url: string | null;
  voice: string;
  tone_keywords: string[];
  values: string[];
  color_palette: string[];
  typography_hints: string[];
  imagery_style: string;
  messaging_pillars: string[];
  do_list: string[];
  dont_list: string[];
  category: string | null;
  confidence: number;
};

const VOICE_HINTS: Array<{ re: RegExp; voice: string; tones: string[] }> = [
  { re: /premium|luxury|artisan|craft/i, voice: 'premium_warm', tones: ['elevated', 'crafted', 'trustworthy'] },
  { re: /fun|bold|spicy|party|festive/i, voice: 'playful_bold', tones: ['energetic', 'festive', 'direct'] },
  { re: /organic|natural|clean|pure|ayurveda/i, voice: 'natural_calm', tones: ['clean', 'honest', 'soothing'] },
  { re: /tech|smart|fast|ai|saas/i, voice: 'modern_precise', tones: ['clear', 'confident', 'efficient'] },
  { re: /family|home|mom|traditional|ghar/i, voice: 'homely_caring', tones: ['warm', 'familiar', 'reassuring'] },
];

function inferVoice(text: string, fallback?: string | null): { voice: string; tones: string[] } {
  for (const h of VOICE_HINTS) {
    if (h.re.test(text)) return { voice: h.voice, tones: h.tones };
  }
  if (fallback) return { voice: fallback, tones: ['clear', 'friendly', 'credible'] };
  return { voice: 'friendly_clear', tones: ['clear', 'friendly', 'credible'] };
}

function topKeywords(text: string, n = 8): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'your', 'you', 'our', 'from', 'this', 'that',
    'are', 'was', 'were', 'have', 'has', 'will', 'can', 'all', 'not', 'but',
  ]);
  const counts = new Map<string, number>();
  for (const t of text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
    if (t.length < 4 || stop.has(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function extractBrandDna(input: BrandDnaInput): BrandDnaProfile {
  const corpus = [
    input.brandName,
    input.description,
    input.pageTitle,
    input.h1,
    input.bodyText,
    input.category,
  ]
    .filter(Boolean)
    .join(' ');

  const { voice, tones } = inferVoice(corpus, input.existingVoice);
  const keywords = topKeywords(corpus);
  const values =
    input.existingValues?.length
      ? input.existingValues
      : keywords.slice(0, 4).map((k) => k);

  const colors =
    input.colors?.length
      ? input.colors
      : voice.includes('natural')
        ? ['#2F5D50', '#F4EFE6', '#C4A574']
        : voice.includes('playful')
          ? ['#E85D04', '#FFF3E0', '#1A1A1A']
          : ['#1877F2', '#0B1B33', '#F5F7FA'];

  let confidence = 0.35;
  if (input.brandName) confidence += 0.15;
  if (input.description || input.bodyText) confidence += 0.2;
  if (input.colors?.length) confidence += 0.1;
  if (input.existingVoice) confidence += 0.1;
  if (input.websiteUrl) confidence += 0.1;
  confidence = Math.min(0.95, confidence);

  const brand = input.brandName || 'Brand';
  return {
    brand_name: brand,
    website_url: input.websiteUrl || null,
    voice,
    tone_keywords: tones,
    values,
    color_palette: colors,
    typography_hints:
      voice.includes('premium')
        ? ['serif headlines', 'generous tracking']
        : ['clean sans headlines', 'high contrast body'],
    imagery_style:
      voice.includes('natural')
        ? 'soft daylight, real ingredients, minimal props'
        : voice.includes('playful')
          ? 'bold color blocks, lifestyle UGC energy'
          : 'packshot-forward, clean studio, social-native crop',
    messaging_pillars: [
      keywords[0] ? `Lead with ${keywords[0]}` : 'Lead with primary benefit',
      'Proof (ingredients / reviews / offer)',
      'Clear CTA for India mobile shoppers',
    ],
    do_list: [
      'Keep product packshot recognizable',
      'One offer per frame',
      'Match landing page H1 to ad hook',
    ],
    dont_list: [
      'Medical / miracle claims',
      'Before/after body shaming',
      'Unreadable text overlays on Stories safe zones',
    ],
    category: input.category || null,
    confidence,
  };
}
