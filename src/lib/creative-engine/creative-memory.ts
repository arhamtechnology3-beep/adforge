import type { CreativeQaScores } from '@/lib/creative-engine/types';

export type CreativeMemoryRecord = {
  userId: string;
  creativeId?: string;
  campaignId?: string;
  conceptId?: string;
  adFormat?: string;
  impressions?: number;
  reach?: number;
  ctr?: number;
  cpc?: number;
  conversions?: number;
  cpa?: number;
  roas?: number;
  qaScores?: CreativeQaScores;
};

export async function recordCreativeMemory(record: CreativeMemoryRecord): Promise<void> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    await admin.from('creative_memory').upsert(
      {
        user_id: record.userId,
        creative_id: record.creativeId || null,
        campaign_id: record.campaignId || null,
        concept_id: record.conceptId || null,
        ad_format: record.adFormat || null,
        impressions: record.impressions || 0,
        reach: record.reach || 0,
        ctr: record.ctr || 0,
        cpc: record.cpc || 0,
        conversions: record.conversions || 0,
        cpa: record.cpa || 0,
        roas: record.roas || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'creative_id' }
    );
  } catch {
    // Table may not exist yet in local dev.
  }
}

export async function readCreativeInsights(userId: string): Promise<string[]> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const { data } = await admin
      .from('creative_memory')
      .select('ad_format, ctr, roas, concept_id')
      .eq('user_id', userId)
      .order('ctr', { ascending: false })
      .limit(20);
    if (!data?.length) return [];
    const ugc = data.filter((row) => row.ad_format === 'video');
    const staticAds = data.filter((row) => row.ad_format === 'single_image');
    const insights: string[] = [];
    if (ugc.length && staticAds.length) {
      const ugcCtr = ugc.reduce((sum, row) => sum + Number(row.ctr || 0), 0) / ugc.length;
      const staticCtr =
        staticAds.reduce((sum, row) => sum + Number(row.ctr || 0), 0) / staticAds.length;
      if (ugcCtr > staticCtr) {
        insights.push('UGC-style video creatives are outperforming static product creatives.');
      }
    }
    return insights;
  } catch {
    return [];
  }
}
