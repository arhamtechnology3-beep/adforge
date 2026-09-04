import { createClient } from '@/lib/supabase/server';
import { isTrialActive } from '@/lib/utils';
import { isAdminEmail } from '@/lib/auth/admins';
import type { SessionUser } from '@/lib/auth/session';

export type TrialAccess = {
  allowed: boolean;
  expired: boolean;
  hasSubscription: boolean;
  trialEndsAt: string | null;
  isAdmin?: boolean;
  message?: string;
};

/** Demo sessions + platform admins always have full access */
export async function checkTrialAccess(user: SessionUser): Promise<TrialAccess> {
  if (user.isDemo || isAdminEmail(user.email)) {
    return {
      allowed: true,
      expired: false,
      hasSubscription: true,
      trialEndsAt: null,
      isAdmin: isAdminEmail(user.email),
    };
  }

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('trial_ends_at, razorpay_subscription_id, email')
      .eq('id', user.id)
      .maybeSingle();

    if (isAdminEmail(profile?.email || user.email)) {
      return {
        allowed: true,
        expired: false,
        hasSubscription: true,
        trialEndsAt: null,
        isAdmin: true,
      };
    }

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
