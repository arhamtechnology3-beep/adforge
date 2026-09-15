import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  sendCapiEvents,
  shopifyOrderToCapiPurchase,
  estimateEmq,
} from '@/lib/meta-optimize/capi';

export const runtime = 'nodejs';

type VerifyStatus = 'not_verified' | 'test_ok' | 'live_ok' | 'error';

function db() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : createClient();
}

/**
 * GET — has this subscriber verified CAPI (test or live Shopify order)?
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await db();
  const { data: logs } = await supabase
    .from('capi_event_logs')
    .select('event_id, ok, dry_run, error, created_at, payload, estimated_emq')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = logs || [];
  const live = rows.find(
    (r) =>
      r.ok &&
      !String(r.event_id || '').startsWith('adforge-test-') &&
      !(r.payload as { _source?: string } | null)?._source?.includes('test')
  );
  const test = rows.find((r) => String(r.event_id || '').startsWith('adforge-test-') && r.ok);

  let status: VerifyStatus = 'not_verified';
  if (live) status = 'live_ok';
  else if (test) status = test.dry_run ? 'test_ok' : 'test_ok';

  const { data: account } = await supabase
    .from('ad_accounts')
    .select('pixel_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    status,
    verified: status === 'test_ok' || status === 'live_ok',
    live: status === 'live_ok',
    lastLiveAt: live?.created_at || null,
    lastTestAt: test?.created_at || null,
    lastError: rows.find((r) => !r.ok)?.error || null,
    pixelLinked: !!account?.pixel_id,
    message:
      status === 'live_ok'
        ? 'Webhook working — a real order Purchase reached AdForge → Meta.'
        : status === 'test_ok'
          ? 'Test passed — AdForge → Meta CAPI path works. Shopify will use the same URL for real orders.'
          : 'Not verified yet — click Verify webhook after adding the URL in Shopify.',
  });
}

/**
 * POST — send a safe test Purchase through the same CAPI path (does not need Shopify).
 * Proves Pixel + token + AdForge endpoint are correct for this subscriber.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await db();
  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('pixel_id, access_token_encrypted')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adAccount?.pixel_id && !process.env.META_PIXEL_ID) {
    return NextResponse.json(
      {
        ok: false,
        status: 'error' as VerifyStatus,
        error: 'Link a Meta Pixel on Campaigns before verifying CAPI.',
      },
      { status: 422 }
    );
  }

  let accessToken: string | null = null;
  if (adAccount?.access_token_encrypted) {
    try {
      const { retrieveToken } = await import('@/lib/meta');
      accessToken = retrieveToken(adAccount.access_token_encrypted);
    } catch {
      accessToken = null;
    }
  }

  const testId = `adforge-test-${Date.now()}`;
  const fakeOrder = {
    id: testId,
    order_number: 999001,
    email: 'capi-test@adforge.local',
    phone: '+919999999999',
    total_price: '1.00',
    currency: 'INR',
    landing_site: 'https://adforge.arhamtechnology.com/campaigns',
    customer: {
      email: 'capi-test@adforge.local',
      phone: '+919999999999',
      first_name: 'AdForge',
      last_name: 'Test',
    },
    billing_address: {
      city: 'Mumbai',
      province_code: 'MH',
      zip: '400001',
      country_code: 'IN',
    },
    line_items: [{ product_id: 'test', quantity: 1 }],
  };

  const event = shopifyOrderToCapiPurchase(fakeOrder as never, {
    eventSourceUrl: 'https://adforge.arhamtechnology.com/campaigns',
  });
  // Force stable test event id for status detection
  event.eventId = testId;

  const result = await sendCapiEvents({
    pixelId: adAccount?.pixel_id || process.env.META_PIXEL_ID || null,
    accessToken: accessToken || process.env.META_CAPI_ACCESS_TOKEN || null,
    events: [event],
    testEventCode: process.env.META_CAPI_TEST_EVENT_CODE || null,
  });

  try {
    await supabase.from('capi_event_logs').insert({
      user_id: user.id,
      event_name: 'Purchase',
      event_id: testId,
      dry_run: result.dryRun,
      ok: result.ok,
      estimated_emq: result.estimatedEmq ?? estimateEmq(event.userData),
      payload: { ...(result.payload as object), _source: 'adforge_test' },
      meta_response: result.metaResponse || null,
      error: result.error || null,
    });
  } catch {
    /* ignore */
  }

  if (result.ok) {
    try {
      const { data: u } = await supabase
        .from('users')
        .select('agent_settings')
        .eq('id', user.id)
        .maybeSingle();
      const prev = (u?.agent_settings as Record<string, unknown>) || {};
      const tracking = (prev.tracking as Record<string, unknown>) || {};
      await supabase
        .from('users')
        .update({
          agent_settings: {
            ...prev,
            tracking: {
              ...tracking,
              capi_test_ok: true,
              capi_verified_at: new Date().toISOString(),
              capi_enabled: tracking.capi_enabled || !result.dryRun,
            },
          },
        })
        .eq('id', user.id);
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    ok: result.ok,
    status: (result.ok ? 'test_ok' : 'error') as VerifyStatus,
    dryRun: result.dryRun,
    eventId: testId,
    estimatedEmq: result.estimatedEmq,
    error: result.error || null,
    message: result.ok
      ? result.dryRun
        ? 'AdForge test path OK (Meta dry-run — token/pixel may still need live send). Check Events Manager Test Events if test_event_code is set.'
        : 'Verified — test Purchase sent to Meta. Your Shopify webhook URL is ready for real orders.'
      : result.error || 'Verification failed',
  });
}
