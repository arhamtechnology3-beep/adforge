/**
 * Replace competitor brand / store names with the client's brand in ad copy.
 * Handles spacing variants: FarmDidi, Farm Didi, farmdidi.com, etc.
 */
export function scrubCompetitorBrands(
  text: string,
  clientBrand: string,
  competitorNames: Array<string | null | undefined> = []
): string {
  let out = (text || '').trim();
  if (!out) return out;

  const names = new Set<string>();
  for (const raw of competitorNames) {
    if (!raw) continue;
    const n = raw.trim();
    if (!n || n.length < 2) continue;
    names.add(n);
    names.add(n.replace(/\s+/g, ''));
    names.add(n.replace(/([a-z])([A-Z])/g, '$1 $2')); // FarmDidi → Farm Didi
    // Domain-ish
    if (!n.includes('.')) {
      names.add(`${n.toLowerCase()}.com`);
      names.add(`www.${n.toLowerCase()}.com`);
    }
  }

  // Always scrub well-known demo competitors if present
  for (const known of ['FarmDidi', 'Farm Didi', 'farmdidi', 'JhaJi', 'Jha Ji', 'Goosebumps']) {
    names.add(known);
  }

  const sorted = Array.from(names).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (!name || name.toLowerCase() === clientBrand.toLowerCase()) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow optional spaces between letters for fused brands: F\s*a\s*r\s*m\s*D\s*i\s*d\s*i
    out = out.replace(new RegExp(escaped, 'gi'), clientBrand);
  }

  // Scrub leftover whitespace
  out = out.replace(/\s{2,}/g, ' ').trim();

  return out;
}

export function scrubHeadline(
  headline: string,
  clientBrand: string,
  competitorNames: Array<string | null | undefined> = []
): string {
  let h = scrubCompetitorBrands(headline || '', clientBrand, competitorNames);
  // Prefer product/offer hook without stuffing brand twice
  const brandRe = new RegExp(`^${clientBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—\\-:]\\s*`, 'i');
  h = h.replace(brandRe, '').trim() || h;
  if (h.length > 40) h = h.slice(0, 40).trim();
  return h;
}
