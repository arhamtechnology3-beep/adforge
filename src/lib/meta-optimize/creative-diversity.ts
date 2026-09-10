import { createHash } from 'crypto';
import type { OptimizeCreativeInput } from './types';

/** Normalize ad copy for similarity hashing. */
export function normalizeCreativeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fingerprint a creative for near-duplicate clustering (Entity-ID proxy). */
export function creativeFingerprint(c: OptimizeCreativeInput): string {
  const base = [
    c.conceptCluster || '',
    c.format || '',
    normalizeCreativeText(c.headline || ''),
    normalizeCreativeText((c.primaryText || '').slice(0, 120)),
  ].join('|');
  return createHash('sha1').update(base).digest('hex').slice(0, 12);
}

export type DiversityReport = {
  formatCount: number;
  formats: string[];
  conceptClusters: string[];
  conceptCount: number;
  nearDuplicateGroups: Array<{ fingerprint: string; creativeIds: string[]; spendShare: number }>;
  fatigued: Array<{ id: string; name: string; frequency: number; ctr: number }>;
  diversityScore: number; // 0–100
  recommendations: string[];
};

function tokenize(s: string): Set<string> {
  return new Set(
    normalizeCreativeText(s)
      .split(' ')
      .filter((t) => t.length > 2)
  );
}

/** Jaccard similarity of headline+text tokens (0–1). */
export function creativeSimilarity(a: OptimizeCreativeInput, b: OptimizeCreativeInput): number {
  const ta = tokenize(`${a.headline || ''} ${a.primaryText || ''} ${a.conceptCluster || ''}`);
  const tb = tokenize(`${b.headline || ''} ${b.primaryText || ''} ${b.conceptCluster || ''}`);
  if (ta.size === 0 && tb.size === 0) return a.format === b.format ? 0.85 : 0.2;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  const j = union === 0 ? 0 : inter / union;
  const formatBoost = a.format === b.format ? 0.1 : 0;
  return Math.min(1, j + formatBoost);
}

export function analyzeCreativeDiversity(creatives: OptimizeCreativeInput[]): DiversityReport {
  const formats = [...new Set(creatives.map((c) => c.format).filter(Boolean))];
  const clusters = [
    ...new Set(
      creatives.map((c) => c.conceptCluster || creativeFingerprint(c)).filter(Boolean)
    ),
  ];

  const byFp = new Map<string, OptimizeCreativeInput[]>();
  for (const c of creatives) {
    const fp = creativeFingerprint(c);
    const list = byFp.get(fp) || [];
    list.push(c);
    byFp.set(fp, list);
  }

  const totalSpend = creatives.reduce((s, c) => s + (c.spend || 0), 0) || 1;
  const nearDuplicateGroups = [...byFp.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([fingerprint, list]) => ({
      fingerprint,
      creativeIds: list.map((c) => c.id),
      spendShare: list.reduce((s, c) => s + c.spend, 0) / totalSpend,
    }));

  // Also cluster high-similarity pairs that don't share an exact fingerprint
  const used = new Set<string>();
  for (let i = 0; i < creatives.length; i++) {
    if (used.has(creatives[i].id)) continue;
    const group = [creatives[i]];
    for (let j = i + 1; j < creatives.length; j++) {
      if (used.has(creatives[j].id)) continue;
      if (creativeSimilarity(creatives[i], creatives[j]) >= 0.6) {
        group.push(creatives[j]);
      }
    }
    if (group.length >= 2) {
      group.forEach((c) => used.add(c.id));
      const already = nearDuplicateGroups.some((g) =>
        group.every((c) => g.creativeIds.includes(c.id))
      );
      if (!already) {
        nearDuplicateGroups.push({
          fingerprint: `sim-${creativeFingerprint(group[0])}`,
          creativeIds: group.map((c) => c.id),
          spendShare: group.reduce((s, c) => s + c.spend, 0) / totalSpend,
        });
      }
    }
  }

  nearDuplicateGroups.sort((a, b) => b.spendShare - a.spendShare);

  // Pairwise high similarity count (for scoring)
  let highSimPairs = 0;
  for (let i = 0; i < creatives.length; i++) {
    for (let j = i + 1; j < creatives.length; j++) {
      if (creativeSimilarity(creatives[i], creatives[j]) >= 0.6) highSimPairs += 1;
    }
  }

  const fatigued = creatives
    .filter((c) => c.frequency >= 3.5 && c.ctr > 0 && c.ctr < 1.2)
    .map((c) => ({ id: c.id, name: c.name, frequency: c.frequency, ctr: c.ctr }));

  let diversityScore = 40;
  diversityScore += Math.min(25, formats.length * 8);
  diversityScore += Math.min(25, clusters.length * 7);
  diversityScore -= Math.min(20, nearDuplicateGroups.length * 8);
  diversityScore -= Math.min(15, fatigued.length * 5);
  diversityScore -= Math.min(15, highSimPairs * 3);
  diversityScore = Math.max(0, Math.min(100, Math.round(diversityScore)));

  const recommendations: string[] = [];
  if (formats.length < 3) {
    recommendations.push('Add at least 3 formats (e.g. Feed image, Carousel, Stories/Reels video).');
  }
  if (clusters.length < 3) {
    recommendations.push('Launch distinct concept angles (offer, UGC, lifestyle) — not copy tweaks.');
  }
  if (nearDuplicateGroups.length) {
    recommendations.push('Consolidate near-duplicate creatives; Meta Andromeda suppresses similar Entity-IDs.');
  }
  if (fatigued.length) {
    recommendations.push(`Refresh ${fatigued.length} fatigued creative(s) (freq ≥ 3.5, soft CTR).`);
  }

  return {
    formatCount: formats.length,
    formats,
    conceptClusters: clusters,
    conceptCount: clusters.length,
    nearDuplicateGroups,
    fatigued,
    diversityScore,
    recommendations,
  };
}
