import type { TrackingSignals } from './types';

export type TrackingHealthReport = {
  score: number; // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: Array<{ id: string; severity: 'critical' | 'high' | 'medium' | 'info'; title: string; detail: string }>;
  checklist: Array<{ id: string; label: string; ok: boolean }>;
};

function gradeFrom(score: number): TrackingHealthReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

const CORE_EVENTS = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'];

export function assessTrackingHealth(
  tracking: TrackingSignals,
  opts?: { spend?: number; clicks?: number; purchases?: number; addToCart?: number }
): TrackingHealthReport {
  const issues: TrackingHealthReport['issues'] = [];
  const checklist: TrackingHealthReport['checklist'] = [];
  let score = 100;

  checklist.push({ id: 'pixel', label: 'Pixel connected', ok: tracking.pixelConnected });
  if (!tracking.pixelConnected) {
    score -= 25;
    issues.push({
      id: 'pixel',
      severity: 'critical',
      title: 'Pixel not connected',
      detail: 'Connect a Meta Pixel so Sales campaigns can optimize for Purchase.',
    });
  }

  checklist.push({ id: 'capi', label: 'CAPI enabled', ok: tracking.capiEnabled });
  if (!tracking.capiEnabled) {
    score -= 20;
    issues.push({
      id: 'capi',
      severity: 'critical',
      title: 'Conversions API off',
      detail: 'Enable Shopify → Meta CAPI so Meta recovers iOS-lost conversions (target EMQ ≥ 8).',
    });
  }

  const emq = tracking.emqScore ?? null;
  checklist.push({ id: 'emq', label: 'EMQ ≥ 8', ok: emq != null && emq >= 8 });
  if (emq == null) {
    score -= 8;
    issues.push({
      id: 'emq_unknown',
      severity: 'medium',
      title: 'EMQ unknown',
      detail: 'Check Events Manager Event Match Quality for Purchase after CAPI is live.',
    });
  } else if (emq < 8) {
    score -= Math.round((8 - emq) * 3);
    issues.push({
      id: 'emq_low',
      severity: 'high',
      title: `EMQ ${emq.toFixed(1)} < 8`,
      detail: 'Send hashed email, phone, fbp/fbc, and external_id on Purchase for higher match quality.',
    });
  }

  const dedup = tracking.dedupRate ?? null;
  checklist.push({ id: 'dedup', label: 'Dedup ≥ 90%', ok: dedup != null && dedup >= 0.9 });
  if (dedup != null && dedup < 0.9) {
    score -= Math.round((0.9 - dedup) * 40);
    issues.push({
      id: 'dedup',
      severity: 'high',
      title: `Dedup ${(dedup * 100).toFixed(0)}% < 90%`,
      detail: 'Reuse the same event_id on browser Pixel and server CAPI events.',
    });
  }

  const events = new Set(tracking.eventsSeen.map((e) => e.toLowerCase()));
  const coreOk = CORE_EVENTS.every((e) => events.has(e.toLowerCase()));
  checklist.push({ id: 'funnel', label: 'Core funnel events', ok: coreOk });
  if (!coreOk) {
    score -= 10;
    issues.push({
      id: 'funnel',
      severity: 'medium',
      title: 'Missing funnel events',
      detail: `Expected ${CORE_EVENTS.join(', ')}. Seen: ${tracking.eventsSeen.join(', ') || 'none'}.`,
    });
  }

  const purchases7d = tracking.purchaseEvents7d ?? 0;
  checklist.push({ id: 'purchase_7d', label: 'Purchase events (7d)', ok: purchases7d > 0 });
  if (purchases7d <= 0 && tracking.pixelConnected) {
    score -= 8;
    issues.push({
      id: 'no_purchase',
      severity: 'high',
      title: 'No Purchase events in 7d',
      detail: 'Verify thank-you page Pixel + CAPI Purchase with value + currency.',
    });
  }

  checklist.push({
    id: 'domain',
    label: 'Domain verified',
    ok: tracking.domainVerified === true,
  });
  if (tracking.domainVerified === false) {
    score -= 5;
    issues.push({
      id: 'domain',
      severity: 'medium',
      title: 'Domain not verified',
      detail: 'Verify your domain in Meta Business Manager for Aggregated Event Measurement.',
    });
  }

  const spend = opts?.spend ?? 0;
  const clicks = opts?.clicks ?? 0;
  const purchases = opts?.purchases ?? 0;
  const atc = opts?.addToCart ?? 0;
  if (spend >= 500 && clicks >= 50 && purchases === 0 && atc === 0) {
    score -= 15;
    issues.push({
      id: 'tracking_gap',
      severity: 'critical',
      title: 'Tracking gap under spend',
      detail: `₹${spend.toFixed(0)} spend / ${clicks} clicks with zero ATC or Purchase — Pixel/CAPI likely broken.`,
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeFrom(score), issues, checklist };
}
