import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { resolveCampaignInput, competitorsFromInput } from '@/lib/auth/campaign-input';
import { readDemoProducts } from '@/lib/product-catalog';
import { createClient } from '@/lib/supabase/server';
import { scrapeAllCompetitors } from '@/lib/ai';
import { planCreativeEngineAsync } from '@/lib/creative-engine';
import type { ProductBrief } from '@/lib/creative-quality';
import type { SelectedLibraryAdInput } from '@/lib/replicate-ads';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const campaignInputId = body.campaign_input_id as string;
  const productId = body.product_id as string;
  const selectedAds = (Array.isArray(body.selected_ads) ? body.selected_ads : []) as SelectedLibraryAdInput[];

  if (!campaignInputId || !productId) {
    return NextResponse.json({ error: 'campaign_input_id and product_id are required' }, { status: 400 });
  }

  const resolvedInput = await resolveCampaignInput(sessionUser, campaignInputId);
  if (!resolvedInput) {
    return NextResponse.json({ error: 'Campaign input not found' }, { status: 404 });
  }

  let productBrief: ProductBrief | null = null;
  if (sessionUser.isDemo) {
    const product = (await readDemoProducts()).find((item) => item.id === productId);
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
    const supabase = await createClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', sessionUser.id)
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

  if (!productBrief?.primaryPackshot) {
    return NextResponse.json({ error: 'Approved product with packshot required' }, { status: 422 });
  }

  const competitors = competitorsFromInput(resolvedInput);
  const competitorIntel = await scrapeAllCompetitors(competitors, { fetchLiveAds: false });

  const plan = await planCreativeEngineAsync({
    campaignInputId,
    product: productBrief,
    selectedAds,
    competitorNames: competitorIntel.map((entry) => entry.brand),
    language: body.generation_brief?.language,
    tone: body.generation_brief?.tone,
    maxDirections: body.max_directions,
    origin: '',
    ownerId: sessionUser.id,
    persistToStorage: false,
  });

  return NextResponse.json({
    patterns: plan.patterns,
    directions: plan.directions,
    truth: plan.truth,
    note: 'Select 1–3 creative directions, then generate your Meta-ready pack.',
  });
}
