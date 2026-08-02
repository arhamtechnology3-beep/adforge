import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSubscription } from '@/lib/razorpay';
import type { PlanTier } from '@/types/database';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planTier } = await request.json();
  if (!['starter', 'growth', 'scale'].includes(planTier)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  try {
    const subscription = await createSubscription(
      planTier as PlanTier,
      profile.email || user.email!,
      profile.name || 'User'
    );

    return NextResponse.json({
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
    });
  } catch (err) {
    console.error('[Billing] Subscription creation failed:', err);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
