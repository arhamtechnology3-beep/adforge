import type { Job } from 'bullmq';
import { resolveCampaignInput, competitorsFromInput } from '@/lib/auth/campaign-input';
import { readDemoProducts } from '@/lib/product-catalog';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { scrapeAllCompetitors } from '@/lib/ai';
import { runCreativeEngine } from '@/lib/creative-engine';
import type { ProductBrief } from '@/lib/creative-quality';
import type { SelectedLibraryAdInput } from '@/lib/replicate-ads';
import { normalizeDemoAd } from '@/lib/auth/demo-ads';
import type { SessionUser } from '@/lib/auth/session';
import { createGenerationJob, updateGenerationJob } from '@/lib/creative-engine/generation-jobs';
import type { MetaAdFormat } from '@/lib/creatives';

type CreativeGenerationPayload = {
  userId: string;
  isDemo: boolean;
  payload: {
    campaign_input_id: string;
    product_id: string;
    selected_ads?: SelectedLibraryAdInput[];
    selected_direction_ids?: string[];
    generation_brief?: {
      language?: string;
      tone?: string;
      formats?: MetaAdFormat[];
      variant_count?: number;
    };
  };
};

export async function processCreativeGenerationJob(job: Job<CreativeGenerationPayload>) {
  const { userId, isDemo, payload } = job.data;
  const packJob = await createGenerationJob({
    userId,
    campaignInputId: payload.campaign_input_id,
    productId: payload.product_id,
    assetType: 'pack',
    sourceAssets: payload,
  });
  await updateGenerationJob(packJob.id, { status: 'processing', started_at: new Date().toISOString() });

  try {
    const resolvedInput = await resolveCampaignInput(
      { id: userId, isDemo } as SessionUser,
      payload.campaign_input_id
    );
    if (!resolvedInput) throw new Error('Campaign input not found');

    let productBrief: ProductBrief | null = null;
    if (isDemo) {
      const product = (await readDemoProducts()).find((item) => item.id === payload.product_id);
      if (product) {
        productBrief = {
          id: product.id,
          brandName: product.brand_name,
          productName: product.product_name,
          category: product.category || 'Products',
          description: product.description || undefined,
          benefits: product.benefits,
          ingredients: product.ingredients,
          price: product.price || undefined,
          offer: product.offer || undefined,
          productUrl: product.product_url || undefined,
          approvedClaims: product.approved_claims,
          prohibitedClaims: product.prohibited_claims,
          primaryPackshot: product.primary_packshot || '',
          packshots: product.packshots?.length ? product.packshots : [product.primary_packshot || ''],
        };
      }
    } else {
      const admin = await createServiceClient();
      const { data } = await admin
        .from('products')
        .select('*')
        .eq('id', payload.product_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        productBrief = {
          id: data.id,
          brandName: data.brand_name,
          productName: data.product_name,
          category: data.category || 'Products',
          description: data.description || undefined,
          benefits: data.benefits || [],
          ingredients: data.ingredients || [],
          price: data.price || undefined,
          offer: data.offer || undefined,
          productUrl: data.product_url || undefined,
          approvedClaims: data.approved_claims || [],
          prohibitedClaims: data.prohibited_claims || [],
          primaryPackshot: data.primary_packshot || '',
          packshots: data.packshots?.length ? data.packshots : [data.primary_packshot || ''],
        };
      }
    }
    if (!productBrief) throw new Error('Product not found');

    const competitors = competitorsFromInput(resolvedInput);
    const competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: false });
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const selectedAds = payload.selected_ads || [];

    const result = await runCreativeEngine({
      campaignInputId: payload.campaign_input_id,
      product: productBrief,
      selectedAds,
      competitorNames: competitorIntel.map((entry) => entry.brand),
      language: payload.generation_brief?.language,
      tone: payload.generation_brief?.tone,
      formats: payload.generation_brief?.formats,
      selectedDirectionIds: payload.selected_direction_ids,
      origin,
      ownerId: userId,
      persistToStorage: !isDemo,
      maxDirections: payload.generation_brief?.variant_count || 3,
    });

    if (isDemo) {
      const savedAds = result.ads.map((ad, index) =>
        normalizeDemoAd(ad as unknown as Record<string, unknown>, index)
      );
      await updateGenerationJob(packJob.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_assets: { ads: savedAds, count: savedAds.length },
      });
      return { ads: savedAds, count: savedAds.length, demo: true };
    }

    const supabase = await createClient();
    await supabase.from('generated_ads').delete().eq('campaign_input_id', payload.campaign_input_id);
    const { data: savedAds, error } = await supabase.from('generated_ads').insert(result.ads).select();
    if (error) throw new Error(error.message);

    await updateGenerationJob(packJob.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      result_assets: { ads: savedAds, count: savedAds?.length || 0 },
    });

    return { ads: savedAds, count: savedAds?.length || 0 };
  } catch (error) {
    await updateGenerationJob(packJob.id, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
