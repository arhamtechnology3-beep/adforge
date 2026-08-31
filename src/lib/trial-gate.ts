import { createClient } from '@/lib/supabase/server';
import { isTrialActive } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth/session';

export type TrialAccess = {
  allowed: boolean;
  expired: boolean;
  hasSubscription: boolean;
  trialEndsAt: string | null;
  message?: string;
};

/** Demo sessions always have full access for local testing */
export async function checkTrialAccess(user: SessionUser): Promise<TrialAccess> {
  if (user.isDemo) {
    return {
      allowed: true,
      expired: false,
      hasSubscription: false,
      trialEndsAt: null,
    };
  }

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('trial_ends_at, razorpay_subscription_id')
      .eq('id', user.id)
      .maybeSingle();

    const hasSubscription = !!profile?.razorpay_subscription_id;
    const trialEndsAt = profile?.trial_ends_at || null;
    const onTrial = isTrialActive(trialEndsAt);

    if (hasSubscription || onTrial) {
      return {
        allowed: true,
        expired: false,
        hasSubscription,
        trialEndsAt,
      };
    }

    return {
      allowed: false,
      expired: true,
      hasSubscription: false,
      trialEndsAt,
      message:
        'Your 7-day trial has ended. Subscribe to continue generating ads and launching campaigns.',
    };
  } catch {
    // Supabase offline — allow access (demo-like fallback)
    return {
      allowed: true,
      expired: false,
      hasSubscription: false,
      trialEndsAt: null,
    };
  }
}
