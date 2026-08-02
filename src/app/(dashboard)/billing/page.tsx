'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, CreditCard } from 'lucide-react';
import { PLANS } from '@/lib/plans';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types/database';
import { daysUntil, isTrialActive, formatCurrency } from '@/lib/utils';

export default function BillingPage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => {
          setProfile(data);
          setLoading(false);
        });
      }
    });
  }, []);

  async function handleSubscribe(planTier: string) {
    setSubscribing(planTier);
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planTier }),
    });

    const data = await res.json();
    if (data.shortUrl) {
      window.location.href = data.shortUrl;
    } else {
      alert(data.error || 'Subscription failed. Check Razorpay configuration.');
    }
    setSubscribing(null);
    setShowConfirm(null);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const onTrial = isTrialActive(profile?.trial_ends_at || null);
  const currentPlan = profile?.plan_tier || 'starter';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted mt-1">Manage your subscription and plan</p>
      </div>

      <div className="card mb-8 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Current Plan</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold capitalize">{currentPlan}</span>
          {onTrial && (
            <span className="text-sm text-accent font-medium">
              Trial · {daysUntil(profile?.trial_ends_at || null)} days left
            </span>
          )}
        </div>
        {profile?.razorpay_subscription_id && (
          <p className="text-sm text-muted mt-2">Active subscription</p>
        )}
      </div>

      {onTrial && !profile?.razorpay_subscription_id && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
          <strong>Before you upgrade:</strong> You will be redirected to Razorpay to complete payment.
          We never charge without your explicit confirmation. Your trial ends on{' '}
          {new Date(profile!.trial_ends_at!).toLocaleDateString('en-IN')}.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan && !onTrial;
          return (
            <div
              key={plan.id}
              className={`card relative ${plan.id === 'growth' ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.id === 'growth' && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3 py-1 rounded-full">
                  Popular
                </span>
              )}
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <p className="text-3xl font-bold mt-2">{plan.priceDisplay}</p>
              <p className="text-sm text-muted mt-1 mb-4">{plan.description}</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="btn-secondary w-full" disabled>Current Plan</button>
              ) : showConfirm === plan.id ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted text-center">
                    Confirm upgrade to {plan.name} at {formatCurrency(plan.price)}/mo?
                  </p>
                  <button
                    className="btn-primary w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={subscribing === plan.id}
                  >
                    {subscribing === plan.id ? 'Redirecting...' : 'Confirm & Pay'}
                  </button>
                  <button className="btn-secondary w-full text-sm" onClick={() => setShowConfirm(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary w-full"
                  onClick={() => setShowConfirm(plan.id)}
                >
                  Upgrade to {plan.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
