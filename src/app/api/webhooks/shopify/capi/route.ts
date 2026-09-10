import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  sendCapiEvents,
  shopifyOrderToCapiPurchase,
  estimateEmq,
} from '@/lib/meta-optimize/capi';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

function verifyShopifyHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Shopify orders/paid (or orders/create) → Meta Conversions API Purchase.
 * Query: ?user_id=<uuid>  OR header X-AdForge-User-Id
 * Env: SHOPIFY_WEBHOOK_SECRET (optional verify), uses ad account token + pixel.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  const hmac = request.headers.get('x-shopify-hmac-sha256');

  if (secret && !verifyShopifyHmac(rawBody, hmac, secret)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  let order: Record<string, unknown>;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const url = new URL(request.url);
  const userId =
    url.searchParams.get('user_id') ||
    request.headers.get('x-adforge-user-id') ||
    '';

  if (!userId) {
    return NextResponse.json(
      { error: 'user_id query param or X-AdForge-User-Id required' },
      { status: 400 }
    );
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await createServiceClient()
    : await createClient();

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('pixel_id, access_token_encrypted')
    .eq('user_id', userId)
    .maybeSingle();

  const event = shopifyOrderToCapiPurchase(order as never, {
    eventSourceUrl: (order.landing_site as string) || undefined,
  });

  let accessToken: string | null = null;
  if (adAccount?.access_token_encrypted) {
    try {
      const { retrieveToken } = await import('@/lib/meta');
      accessToken = retrieveToken(adAccount.access_token_encrypted);
    } catch {
      accessToken = null;
    }
  }

  const testEventCode =
    url.searchParams.get('test_event_code') ||
    process.env.META_CAPI_TEST_EVENT_CODE ||
    null;

  const result = await sendCapiEvents({
    pixelId: adAccount?.pixel_id || process.env.META_PIXEL_ID || null,
    accessToken: accessToken || process.env.META_CAPI_ACCESS_TOKEN || null,
    events: [event],
    testEventCode,
  });

  // Best-effort log
  try {
    await supabase.from('capi_event_logs').insert({
      user_id: userId,
      event_name: 'Purchase',
      event_id: event.eventId,
      dry_run: result.dryRun,
      ok: result.ok,
      estimated_emq: result.estimatedEmq,
      payload: result.payload,
      meta_response: result.metaResponse || null,
      error: result.error || null,
    });
  } catch {
    // migration may not be applied
  }

  // Mark CAPI enabled on success
  if (result.ok && !result.dryRun) {
    try {
      const { data: u } = await supabase
        .from('users')
        .select('agent_settings')
        .eq('id', userId)
        .maybeSingle();
      const agent_settings = {
        ...((u?.agent_settings as object) || {}),
        tracking: {
          ...(((u?.agent_settings as Record<string, unknown>)?.tracking as object) || {}),
          capi_enabled: true,
          emq_score: estimateEmq(event.userData),
        },
      };
      await supabase.from('users').update({ agent_settings }).eq('id', userId);
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    ok: result.ok,
    dryRun: result.dryRun,
    eventId: event.eventId,
    estimatedEmq: result.estimatedEmq,
    error: result.error || null,
  });
}
