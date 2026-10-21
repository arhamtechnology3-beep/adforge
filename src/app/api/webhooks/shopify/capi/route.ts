import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  sendCapiEvents,
  shopifyOrderToCapiPurchase,
  estimateEmq,
} from '@/lib/meta-optimize/capi';
import { createHmac, timingSafeEqual } from 'crypto';
import { resolveWebhookStore } from '@/lib/stores';

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
 * Query: ?store_id=<uuid> for multi-store accounts.
 * Single-store accounts may keep ?user_id=<uuid> or header X-AdForge-User-Id.
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
  const resolved = await resolveWebhookStore({
    userId: url.searchParams.get('user_id') || request.headers.get('x-adforge-user-id'),
    storeId: url.searchParams.get('store_id') || request.headers.get('x-adforge-store-id'),
  });
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { userId, storeId } = resolved;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await createServiceClient()
    : await createClient();

  let accountQuery = supabase.from('ad_accounts').select('pixel_id, access_token_encrypted').eq('user_id', userId);
  if (storeId) accountQuery = accountQuery.eq('store_id', storeId);
  const { data: adAccount } = await accountQuery.maybeSingle();

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

  // Best-effort log (mark Shopify vs unknown for Verify UI)
  const shopifyTopic = request.headers.get('x-shopify-topic');
  try {
    await supabase.from('capi_event_logs').insert({
      user_id: userId,
      ...(storeId ? { store_id: storeId } : {}),
      event_name: 'Purchase',
      event_id: event.eventId,
      dry_run: result.dryRun,
      ok: result.ok,
      estimated_emq: result.estimatedEmq,
      payload: {
        ...(result.payload as object),
        _source: shopifyTopic ? 'shopify' : 'webhook',
        _shopify_topic: shopifyTopic || null,
      },
      meta_response: result.metaResponse || null,
      error: result.error || null,
    });
  } catch {
    // migration may not be applied
  }

  // Mark CAPI enabled on success
  if (result.ok && !result.dryRun) {
    try {
      const settingsTable = storeId ? 'stores' : 'users';
      const settingsId = storeId || userId;
      const { data: u } = await supabase
        .from(settingsTable)
        .select('agent_settings')
        .eq('id', settingsId)
        .maybeSingle();
      const agent_settings = {
        ...((u?.agent_settings as object) || {}),
        tracking: {
          ...(((u?.agent_settings as Record<string, unknown>)?.tracking as object) || {}),
          capi_enabled: true,
          emq_score: estimateEmq(event.userData),
        },
      };
      let settingsUpdate = supabase.from(settingsTable).update({ agent_settings }).eq('id', settingsId);
      if (storeId) settingsUpdate = settingsUpdate.eq('user_id', userId);
      await settingsUpdate;
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
