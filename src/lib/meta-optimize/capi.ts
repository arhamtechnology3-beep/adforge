import { createHash } from 'crypto';

/** Meta CAPI requires lowercase SHA256 of PII fields. */
export function hashPii(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

export function hashPhoneE164(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return undefined;
  // Prefer India default if 10-digit local
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  return createHash('sha256').update(e164).digest('hex');
}

export type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null; // ISO 2
};

export type CapiCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  order_id?: string;
  num_items?: number;
};

export type CapiEventInput = {
  eventName: string;
  eventTime?: number; // unix seconds
  eventId: string;
  eventSourceUrl?: string;
  actionSource?: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  userData: CapiUserData;
  customData?: CapiCustomData;
};

export type CapiPayload = {
  data: Array<Record<string, unknown>>;
};

/** Build a Graph API-ready Conversions API payload (does not send). */
export function buildCapiPayload(events: CapiEventInput[]): CapiPayload {
  return {
    data: events.map((e) => {
      const ud: Record<string, unknown> = {};
      const em = hashPii(e.userData.email);
      const ph = hashPhoneE164(e.userData.phone);
      const external = hashPii(e.userData.externalId);
      const fn = hashPii(e.userData.firstName);
      const ln = hashPii(e.userData.lastName);
      const ct = hashPii(e.userData.city);
      const st = hashPii(e.userData.state);
      const zp = hashPii(e.userData.zip);
      const country = hashPii(e.userData.country || 'in');

      if (em) ud.em = [em];
      if (ph) ud.ph = [ph];
      if (external) ud.external_id = [external];
      if (fn) ud.fn = [fn];
      if (ln) ud.ln = [ln];
      if (ct) ud.ct = [ct];
      if (st) ud.st = [st];
      if (zp) ud.zp = [zp];
      if (country) ud.country = [country];
      if (e.userData.clientIpAddress) ud.client_ip_address = e.userData.clientIpAddress;
      if (e.userData.clientUserAgent) ud.client_user_agent = e.userData.clientUserAgent;
      if (e.userData.fbp) ud.fbp = e.userData.fbp;
      if (e.userData.fbc) ud.fbc = e.userData.fbc;

      const row: Record<string, unknown> = {
        event_name: e.eventName,
        event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: e.actionSource || 'website',
        user_data: ud,
      };
      if (e.eventSourceUrl) row.event_source_url = e.eventSourceUrl;
      if (e.customData) row.custom_data = e.customData;
      return row;
    }),
  };
}

/**
 * Rough EMQ estimator (0–10) from which match keys are present.
 * Real EMQ comes from Events Manager; this guides setup quality.
 */
export function estimateEmq(userData: CapiUserData): number {
  let score = 0;
  if (userData.email) score += 2.5;
  if (userData.phone) score += 2.0;
  if (userData.fbp) score += 1.5;
  if (userData.fbc) score += 1.5;
  if (userData.externalId) score += 1.0;
  if (userData.clientIpAddress && userData.clientUserAgent) score += 0.8;
  if (userData.firstName && userData.lastName) score += 0.4;
  if (userData.city && userData.zip) score += 0.3;
  return Math.min(10, Math.round(score * 10) / 10);
}

export type ShopifyOrderLike = {
  id: string | number;
  order_number?: string | number;
  email?: string | null;
  phone?: string | null;
  total_price?: string | number;
  currency?: string;
  landing_site?: string | null;
  browser_ip?: string | null;
  client_details?: { user_agent?: string | null } | null;
  customer?: { id?: string | number; email?: string | null; phone?: string | null; first_name?: string | null; last_name?: string | null } | null;
  billing_address?: {
    first_name?: string | null;
    last_name?: string | null;
    city?: string | null;
    province_code?: string | null;
    zip?: string | null;
    country_code?: string | null;
    phone?: string | null;
  } | null;
  line_items?: Array<{ product_id?: string | number; quantity?: number; sku?: string }>;
  note_attributes?: Array<{ name: string; value: string }>;
};

function attr(order: ShopifyOrderLike, name: string): string | undefined {
  const hit = order.note_attributes?.find((a) => a.name.toLowerCase() === name.toLowerCase());
  return hit?.value;
}

/** Map a Shopify order webhook payload → CAPI Purchase event. */
export function shopifyOrderToCapiPurchase(
  order: ShopifyOrderLike,
  opts?: { eventSourceUrl?: string; fbp?: string | null; fbc?: string | null }
): CapiEventInput {
  const email = order.email || order.customer?.email || null;
  const phone =
    order.phone || order.customer?.phone || order.billing_address?.phone || null;
  const value =
    typeof order.total_price === 'string'
      ? parseFloat(order.total_price)
      : Number(order.total_price || 0);
  const contentIds = (order.line_items || [])
    .map((li) => String(li.product_id || li.sku || ''))
    .filter(Boolean);
  const numItems = (order.line_items || []).reduce((s, li) => s + (li.quantity || 1), 0);

  const eventId = `shopify_order_${order.id}`;
  return {
    eventName: 'Purchase',
    eventId,
    eventSourceUrl: opts?.eventSourceUrl || order.landing_site || undefined,
    actionSource: 'website',
    userData: {
      email,
      phone,
      externalId: order.customer?.id != null ? String(order.customer.id) : String(order.id),
      clientIpAddress: order.browser_ip || null,
      clientUserAgent: order.client_details?.user_agent || null,
      fbp: opts?.fbp || attr(order, '_fbp') || attr(order, 'fbp') || null,
      fbc: opts?.fbc || attr(order, '_fbc') || attr(order, 'fbc') || null,
      firstName: order.customer?.first_name || order.billing_address?.first_name || null,
      lastName: order.customer?.last_name || order.billing_address?.last_name || null,
      city: order.billing_address?.city || null,
      state: order.billing_address?.province_code || null,
      zip: order.billing_address?.zip || null,
      country: (order.billing_address?.country_code || 'IN').toLowerCase(),
    },
    customData: {
      value: Number.isFinite(value) ? value : 0,
      currency: (order.currency || 'INR').toUpperCase(),
      content_ids: contentIds,
      content_type: 'product',
      order_id: String(order.order_number || order.id),
      num_items: numItems || undefined,
    },
  };
}

export type CapiSendResult = {
  ok: boolean;
  dryRun: boolean;
  events: number;
  estimatedEmq: number;
  payload: CapiPayload;
  metaResponse?: unknown;
  error?: string;
};

/**
 * Send CAPI events to Meta Graph API.
 * If META_CAPI_ACCESS_TOKEN / pixel missing → dry-run payload only.
 */
export async function sendCapiEvents(input: {
  pixelId: string | null | undefined;
  accessToken: string | null | undefined;
  events: CapiEventInput[];
  testEventCode?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<CapiSendResult> {
  const payload = buildCapiPayload(input.events);
  const estimatedEmq =
    input.events.reduce((s, e) => s + estimateEmq(e.userData), 0) /
    Math.max(1, input.events.length);

  if (!input.pixelId || !input.accessToken) {
    return {
      ok: true,
      dryRun: true,
      events: input.events.length,
      estimatedEmq,
      payload,
      error: 'Missing pixelId or accessToken — dry-run only',
    };
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${input.pixelId}/events`);
  url.searchParams.set('access_token', input.accessToken);
  const body: Record<string, unknown> = { data: payload.data };
  if (input.testEventCode) body.test_event_code = input.testEventCode;

  try {
    const fetchFn = input.fetchImpl || fetch;
    const res = await fetchFn(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const metaResponse = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        dryRun: false,
        events: input.events.length,
        estimatedEmq,
        payload,
        metaResponse,
        error: `Meta CAPI HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      dryRun: false,
      events: input.events.length,
      estimatedEmq,
      payload,
      metaResponse,
    };
  } catch (e) {
    return {
      ok: false,
      dryRun: false,
      events: input.events.length,
      estimatedEmq,
      payload,
      error: e instanceof Error ? e.message : 'CAPI send failed',
    };
  }
}
