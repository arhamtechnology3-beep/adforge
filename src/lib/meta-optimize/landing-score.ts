export type LandingSignals = {
  url: string;
  adHeadline?: string | null;
  adPrimaryText?: string | null;
  pageTitle?: string | null;
  h1?: string | null;
  metaDescription?: string | null;
  hasCta?: boolean;
  mobileFriendly?: boolean;
  loadTimeMs?: number | null;
  hasTrustSignals?: boolean; // reviews, badges, COD, etc.
  hasHttps?: boolean;
  hasPixelHint?: boolean;
  formFieldCount?: number | null;
  messageMatchKeywords?: string[]; // optional precomputed
};

export type LandingScoreReport = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  messageMatch: number;
  speed: number;
  mobile: number;
  trust: number;
  tracking: number;
  issues: string[];
  quickWins: string[];
};

function gradeFrom(score: number): LandingScoreReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

export function messageMatchScore(
  adText: string,
  pageText: string
): number {
  const a = tokens(adText);
  const b = tokens(pageText);
  if (a.size === 0) return 50;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return Math.round((hit / a.size) * 100);
}

export function scoreLandingPage(s: LandingSignals): LandingScoreReport {
  const issues: string[] = [];
  const quickWins: string[] = [];

  const ad = `${s.adHeadline || ''} ${s.adPrimaryText || ''}`.trim();
  const page = `${s.pageTitle || ''} ${s.h1 || ''} ${s.metaDescription || ''}`.trim();
  const messageMatch =
    s.messageMatchKeywords && s.messageMatchKeywords.length
      ? Math.min(
          100,
          Math.round(
            (s.messageMatchKeywords.filter((k) =>
              page.toLowerCase().includes(k.toLowerCase())
            ).length /
              s.messageMatchKeywords.length) *
              100
          )
        )
      : messageMatchScore(ad, page);

  if (messageMatch < 40) {
    issues.push('Weak message match between ad and landing page');
    quickWins.push('Mirror the ad headline/offer in the H1 and hero CTA');
  }

  let speed = 80;
  if (s.loadTimeMs == null) {
    speed = 55;
    issues.push('Page speed unknown — measure LCP on mobile');
  } else if (s.loadTimeMs > 4000) {
    speed = 25;
    issues.push(`Slow load (${s.loadTimeMs}ms)`);
    quickWins.push('Compress hero image; defer non-critical JS');
  } else if (s.loadTimeMs > 2500) {
    speed = 55;
    issues.push(`Moderate load (${s.loadTimeMs}ms)`);
  } else {
    speed = 95;
  }

  const mobile = s.mobileFriendly === false ? 30 : s.mobileFriendly ? 95 : 60;
  if (s.mobileFriendly === false) {
    issues.push('Not mobile-friendly');
    quickWins.push('Fix viewport + tap targets for IG/FB traffic');
  }

  let trust = 50;
  if (s.hasTrustSignals) trust += 30;
  else {
    issues.push('Missing trust signals');
    quickWins.push('Add reviews, COD badge, or secure checkout cues');
  }
  if (s.hasHttps !== false) trust += 15;
  else {
    trust -= 20;
    issues.push('HTTPS missing');
  }
  if (s.hasCta) trust += 5;
  else {
    issues.push('No clear CTA');
    quickWins.push('Add a single primary Shop Now / Buy CTA above the fold');
  }
  trust = Math.max(0, Math.min(100, trust));

  let tracking = 50;
  if (s.hasPixelHint) tracking = 90;
  else {
    tracking = 35;
    issues.push('Pixel not detected on landing URL');
    quickWins.push('Install Meta Pixel + CAPI on product & thank-you pages');
  }

  if (s.formFieldCount != null && s.formFieldCount > 6) {
    issues.push('Form too long for cold traffic');
    quickWins.push('Reduce form to ≤4 fields or use Instant Form');
  }

  const score = Math.round(
    messageMatch * 0.35 + speed * 0.2 + mobile * 0.15 + trust * 0.2 + tracking * 0.1
  );

  return {
    score,
    grade: gradeFrom(score),
    messageMatch,
    speed,
    mobile,
    trust,
    tracking,
    issues,
    quickWins: [...new Set(quickWins)].slice(0, 6),
  };
}
