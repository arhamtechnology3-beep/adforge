import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import type { PlanTier } from '@/types/database';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  const supabase = await createServiceClient();

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const sub = event.payload.subscription.entity;
      const planTier = (sub.notes?.plan_tier || 'starter') as PlanTier;
      const email = sub.notes?.email;

      if (email) {
        await supabase
          .from('users')
          .update({
            plan_tier: planTier,
            razorpay_subscription_id: sub.id,
            trial_ends_at: null,
          })
          .eq('email', email);
      }
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.halted': {
      const sub = event.payload.subscription.entity;
      const email = sub.notes?.email;

      if (email) {
        await supabase
          .from('users')
          .update({
            plan_tier: 'starter',
            razorpay_subscription_id: null,
          })
          .eq('email', email);
      }
      break;
    }

    case 'payment.failed': {
      const payment = event.payload.payment?.entity;
      const email = payment?.email;
      if (email) {
        console.warn(`[Razorpay] Payment failed for ${email}`);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
