export type AttributionSignals = {
  window?: string | null; // e.g. '7d_click_1d_view'
  viewThroughShare?: number | null; // 0–1 of conversions from VT
  aemConfigured?: boolean;
  skanEnabled?: boolean;
  dedupRate?: number | null;
  cmpConsentRate?: number | null; // 0–1
  crossDeviceEnabled?: boolean;
  salesCycleDays?: number | null;
};

export type AttributionReport = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendedWindow: string;
  issues: string[];
  recommendations: string[];
};

function gradeFrom(score: number): AttributionReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function recommendAttributionWindow(salesCycleDays?: number | null): string {
  if (salesCycleDays != null && salesCycleDays > 14) return '28d_click_1d_view';
  if (salesCycleDays != null && salesCycleDays <= 3) return '1d_click';
  return '7d_click_1d_view';
}

export function assessAttribution(signals: AttributionSignals): AttributionReport {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  const recommendedWindow = recommendAttributionWindow(signals.salesCycleDays);

  if (!signals.window) {
    score -= 15;
    issues.push('Attribution window not recorded on ad sets');
    recommendations.push(`Set ad set attribution to ${recommendedWindow}`);
  } else if (signals.window !== recommendedWindow) {
    score -= 8;
    recommendations.push(
      `Current window ${signals.window}; for your sales cycle prefer ${recommendedWindow}`
    );
  }

  if (signals.viewThroughShare != null && signals.viewThroughShare > 0.4) {
    score -= 10;
    issues.push('View-through share >40% — brand/halo heavy; validate with holdout');
    recommendations.push('Run Conversion Lift or compare 1d click-only for decisioning');
  }

  if (signals.aemConfigured === false) {
    score -= 12;
    issues.push('AEM not configured');
    recommendations.push('Verify domain + prioritize Purchase in Aggregated Event Measurement');
  }

  if (signals.dedupRate != null && signals.dedupRate < 0.9) {
    score -= 15;
    issues.push(`Dedup ${(signals.dedupRate * 100).toFixed(0)}% < 90%`);
    recommendations.push('Align Pixel + CAPI event_id for Purchase');
  }

  if (signals.cmpConsentRate != null && signals.cmpConsentRate < 0.5) {
    score -= 10;
    issues.push('Consent rate <50% — signal loss');
    recommendations.push('Optimize CMP for accept rate; rely more on CAPI hashed PII');
  }

  if (signals.skanEnabled === false) {
    recommendations.push('If running App campaigns, enable SKAN / AdAttributionKit');
  }

  if (signals.crossDeviceEnabled === false) {
    score -= 5;
    recommendations.push('Enable Customer List / advanced matching for cross-device stitching');
  }

  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeFrom(score), recommendedWindow, issues, recommendations };
}
