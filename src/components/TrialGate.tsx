'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import type { User } from '@/types/database';
import { isTrialActive } from '@/lib/utils';

const ALLOWED_PATHS = ['/billing', '/dashboard'];

export default function TrialGate({
  user,
  pathname,
  children,
}: {
  user: User | null;
  pathname: string;
  children: React.ReactNode;
}) {
  if (!user) return <>{children}</>;

  const onTrial = isTrialActive(user.trial_ends_at);
  const hasSubscription = !!user.razorpay_subscription_id;
  const expired = !onTrial && !hasSubscription;

  if (!expired) return <>{children}</>;
  if (ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[1px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-6 bg-white/60 backdrop-blur-sm z-20">
        <div className="meta-card max-w-md w-full p-8 text-center shadow-xl border-2 border-[var(--meta-blue)]/20">
          <div className="w-14 h-14 rounded-full bg-[var(--meta-blue)]/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-[var(--meta-blue)]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Trial ended</h2>
          <p className="text-sm text-[var(--muted)] mb-6">
            Subscribe to keep cloning competitor ads, generating creatives, and launching Meta campaigns.
            No silent billing — you choose when to upgrade.
          </p>
          <Link href="/billing" className="btn-primary inline-flex items-center gap-2 w-full justify-center">
            <Sparkles className="w-4 h-4" /> View plans from ₹2,499/mo
          </Link>
          <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:underline mt-4 inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
