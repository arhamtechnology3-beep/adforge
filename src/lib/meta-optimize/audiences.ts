/** Lookalike / custom audience planning (spec → Meta Marketing API shapes). */

export type AudienceSeed = {
  type: 'purchasers' | 'atc' | 'view_content' | 'engagement' | 'customer_list' | 'video_viewers';
  sourceLabel: string;
  approximateSize?: number | null;
};

export type LookalikePlan = {
  name: string;
  seed: AudienceSeed;
  country: string;
  ratio: number; // 0.01 = 1%
  exclusions: string[];
  rationale: string;
  ready: boolean;
  blockers: string[];
  metaCreateShape: {
    name: string;
    subtype: 'LOOKALIKE';
    lookalike_spec: {
      type: 'similarity' | 'reach';
      country: string;
      ratio: number;
    };
    origin_audience: string;
  };
};

export type AudiencePlanReport = {
  customAudiences: Array<{ name: string; rule: string; retentionDays: number }>;
  lookalikes: LookalikePlan[];
  exclusions: string[];
  notes: string[];
};

export function planAudiences(input: {
  brandName?: string | null;
  country?: string;
  hasPurchasePixel?: boolean;
  hasCustomerList?: boolean;
  purchaseCount90d?: number;
}): AudiencePlanReport {
  const country = (input.country || 'IN').toUpperCase();
  const brand = input.brandName || 'Brand';
  const notes: string[] = [];
  const exclusions = [
    `${brand} · Purchasers 180d`,
    `${brand} · Checkout starters 14d`,
  ];

  const customAudiences = [
    {
      name: `${brand} · Purchasers 180d`,
      rule: 'Purchase pixel / CAPI last 180 days',
      retentionDays: 180,
    },
    {
      name: `${brand} · ATC 30d`,
      rule: 'AddToCart last 30 days exclude purchasers',
      retentionDays: 30,
    },
    {
      name: `${brand} · ViewContent 14d`,
      rule: 'ViewContent last 14 days exclude ATC/Purchase',
      retentionDays: 14,
    },
    {
      name: `${brand} · Video 50% 30d`,
      rule: 'Video view ≥50% last 30 days',
      retentionDays: 30,
    },
  ];

  const lookalikes: LookalikePlan[] = [];
  const purchaseReady =
    !!input.hasPurchasePixel && (input.purchaseCount90d || 0) >= 100;

  const seed: AudienceSeed = purchaseReady
    ? {
        type: 'purchasers',
        sourceLabel: `${brand} · Purchasers 180d`,
        approximateSize: input.purchaseCount90d || null,
      }
    : input.hasCustomerList
      ? {
          type: 'customer_list',
          sourceLabel: `${brand} · Customer list`,
          approximateSize: null,
        }
      : {
          type: 'engagement',
          sourceLabel: `${brand} · Page engagers 90d`,
          approximateSize: null,
        };

  if (!purchaseReady) {
    notes.push(
      'Purchaser seed <100 / 90d — start with engagers or customer list until Pixel/CAPI volume grows.'
    );
  }

  for (const ratio of [0.01, 0.02, 0.05]) {
    const pct = Math.round(ratio * 100);
    lookalikes.push({
      name: `${brand} · LAL ${pct}% ${country}`,
      seed,
      country,
      ratio,
      exclusions,
      rationale:
        ratio <= 0.01
          ? 'Highest similarity for prospecting efficiency'
          : ratio <= 0.02
            ? 'Balanced scale vs similarity'
            : 'Broader reach once 1–2% saturates',
      ready: purchaseReady || !!input.hasCustomerList,
      blockers:
        purchaseReady || input.hasCustomerList
          ? []
          : ['Need ≥100 purchasers or uploaded customer list'],
      metaCreateShape: {
        name: `${brand} · LAL ${pct}% ${country}`,
        subtype: 'LOOKALIKE',
        lookalike_spec: {
          type: ratio <= 0.02 ? 'similarity' : 'reach',
          country,
          ratio,
        },
        origin_audience: seed.sourceLabel,
      },
    });
  }

  notes.push('Always exclude purchasers + recent checkout from cold prospecting.');
  notes.push('Prefer Advantage+ Audience only after exclusions + strong creative diversity.');

  return { customAudiences, lookalikes, exclusions, notes };
}
