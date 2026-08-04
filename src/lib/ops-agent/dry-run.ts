import type { InsightBreakdowns } from '@/types/database';
import type { CampaignMetrics, CreativeRow, SnapshotRow } from './types';

/** Sample datasets so Ops + Reports Hub work before Meta App is connected */
export function dryRunCampaignMetrics(): CampaignMetrics[] {
  return [
    {
      campaignId: 'dry-camp-1',
      campaignName: 'Festive Pickles · Traffic',
      status: 'active',
      budget: 500,
      spend: 428,
      impressions: 18420,
      clicks: 312,
      cpc: 1.37,
      cpm: 23.2,
      ctr: 1.69,
      cpa: 86,
      roas: 2.4,
      frequency: 2.1,
      purchases: 5,
      add_to_cart: 28,
      initiate_checkout: 11,
      conversion_rate: 1.6,
      video_views: 0,
      engagement_rate: 3.2,
      revenue: 1028,
      reach: 8760,
    },
    {
      campaignId: 'dry-camp-2',
      campaignName: 'UGC Stories · Conversions',
      status: 'active',
      budget: 800,
      spend: 760,
      impressions: 42100,
      clicks: 210,
      cpc: 3.62,
      cpm: 18.1,
      ctr: 0.5,
      cpa: 190,
      roas: 0.9,
      frequency: 4.2,
      purchases: 4,
      add_to_cart: 14,
      initiate_checkout: 6,
      conversion_rate: 1.9,
      video_views: 8200,
      engagement_rate: 2.1,
      revenue: 684,
      reach: 10020,
    },
  ];
}

export function dryRunSnapshots(days = 14): SnapshotRow[] {
  const camps = dryRunCampaignMetrics();
  const rows: SnapshotRow[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    for (const c of camps) {
      const jitter = 0.75 + (Math.sin(i + c.spend) + 1) * 0.2;
      rows.push({
        ...c,
        spend: Math.round(c.spend * jitter * 0.85),
        impressions: Math.round(c.impressions * jitter * 0.85),
        clicks: Math.round(c.clicks * jitter * 0.85),
        purchases: Math.max(0, Math.round(c.purchases * jitter * 0.5)),
        revenue: Math.round(c.revenue * jitter * 0.85),
        date,
        breakdowns: dryRunBreakdowns(),
      });
    }
  }
  return rows;
}

export function dryRunBreakdowns(): InsightBreakdowns {
  return {
    placement: [
      { name: 'Facebook Feed', spend: 210, impressions: 9000, ctr: 1.8 },
      { name: 'Instagram Feed', spend: 160, impressions: 6200, ctr: 1.5 },
      { name: 'Instagram Stories', spend: 90, impressions: 4100, ctr: 1.1 },
      { name: 'Reels', spend: 70, impressions: 3800, ctr: 2.0 },
      { name: 'Audience Network', spend: 30, impressions: 2200, ctr: 0.4 },
    ],
    age: [
      { name: '18-24', spend: 80, purchases: 1 },
      { name: '25-34', spend: 220, purchases: 3 },
      { name: '35-44', spend: 180, purchases: 2 },
      { name: '45-54', spend: 60, purchases: 1 },
    ],
    gender: [
      { name: 'Female', spend: 340 },
      { name: 'Male', spend: 180 },
    ],
    device: [
      { name: 'Android', spend: 310, ctr: 1.7 },
      { name: 'iOS', spend: 160, ctr: 1.4 },
      { name: 'Desktop', spend: 50, ctr: 0.9 },
    ],
    geo: [
      { name: 'Maharashtra', spend: 140 },
      { name: 'Gujarat', spend: 110 },
      { name: 'Karnataka', spend: 90 },
      { name: 'Delhi NCR', spend: 85 },
    ],
    audience: [
      { name: 'Interest · Homemade food', spend: 200, cpa: 78, roas: 2.6 },
      { name: 'Lookalike · Purchasers 1%', spend: 180, cpa: 92, roas: 2.1 },
      { name: 'Retarget · ATC 7d', spend: 90, cpa: 54, roas: 3.4 },
    ],
  };
}

export function dryRunCreatives(): CreativeRow[] {
  return [
    {
      id: 'cr-1',
      name: 'Offer · Chana Keri 1:1',
      format: 'single_image',
      spend: 210,
      ctr: 2.1,
      cpc: 1.1,
      cpa: 72,
      frequency: 1.8,
      copy_text: 'Festive jars selling out — shop homemade pickles today.',
      headline: 'Taste of tradition',
    },
    {
      id: 'cr-2',
      name: 'UGC · Stories 9:16',
      format: 'stories',
      spend: 180,
      ctr: 1.4,
      cpc: 1.8,
      cpa: 95,
      frequency: 2.6,
    },
    {
      id: 'cr-3',
      name: 'Video · Weekend rush',
      format: 'video',
      spend: 260,
      ctr: 0.55,
      cpc: 3.4,
      cpa: 188,
      frequency: 4.1,
      copy_text: 'YOU ARE OVERWEIGHT? Lose 10kg guaranteed!!!',
      headline: 'Miracle pickle diet',
    },
  ];
}

export function dryRunPriorCpa(): Record<string, number[]> {
  return {
    'dry-camp-1': [82, 88, 79],
    'dry-camp-2': [195, 210, 188],
  };
}
