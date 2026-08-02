'use client';

import { daysUntil, isTrialActive } from '@/lib/utils';
import type { User } from '@/types/database';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

interface TrialBannerProps {
  user: User | null;
}

export default function TrialBanner({ user }: TrialBannerProps) {
  if (!user) return null;

  const onTrial = isTrialActive(user.trial_ends_at);
  const daysLeft = daysUntil(user.trial_ends_at);
  const hasSubscription = !!user.razorpay_subscription_id;

  if (!onTrial && hasSubscription) return null;

  if (onTrial && !hasSubscription) {
    return (
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-foreground">
            Free trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
          </p>
          <p className="text-sm text-muted mt-0.5">
            Your trial ends on{' '}
            {new Date(user.trial_ends_at!).toLocaleDateString('en-IN')}.
            Upgrade before then to keep your campaigns running — we never charge without your explicit confirmation.
          </p>
        </div>
        <Link href="/billing" className="btn-primary text-sm whitespace-nowrap">
          Upgrade Now
        </Link>
      </div>
    );
  }

  if (!onTrial && !hasSubscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-800">Trial expired</p>
          <p className="text-sm text-red-600 mt-0.5">
            Subscribe to continue using Meta Ads. No silent auto-billing — you choose when to upgrade.
          </p>
        </div>
        <Link href="/billing" className="btn-primary text-sm whitespace-nowrap">
          Choose a Plan
        </Link>
      </div>
    );
  }

  return null;
}
