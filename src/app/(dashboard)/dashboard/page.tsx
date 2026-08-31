import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Rocket, Sparkles, Megaphone, BarChart3 } from 'lucide-react';
import { getPlan } from '@/lib/plans';
import { daysUntil, isTrialActive } from '@/lib/utils';
import type { User, AdAccount } from '@/types/database';

export default async function DashboardPage() {
  let profile: User | null = null;
  let campaignCount = 0;
  let adCount = 0;
  let adAccount: AdAccount | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: p } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      profile = p;

      const { count: cCount } = await supabase
        .from('meta_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      campaignCount = cCount || 0;

      const { count: aCount } = await supabase
        .from('generated_ads')
        .select('*, campaigns_input!inner(*)', { count: 'exact', head: true })
        .eq('campaigns_input.user_id', user.id);
      adCount = aCount || 0;

      const { data: acc } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();
      adAccount = acc;
    }
  } catch {
    // Network / Supabase offline fallback
  }

  // Demo fallback when profile is null
  if (!profile) {
    profile = {
      id: 'demo-user-id',
      email: 'jesalp85@gmail.com',
      name: 'Jesal',
      plan_tier: 'growth',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as User;
    campaignCount = 2;
    adCount = 10;
  }

  const plan = getPlan(profile?.plan_tier || 'starter');
  const onTrial = isTrialActive(profile?.trial_ends_at || null);

  const steps = [
    { label: 'Complete onboarding', done: !!adAccount, href: '/onboarding', icon: Rocket },
    { label: 'Generate ad creatives', done: adCount > 0, href: '/ads', icon: Sparkles },
    { label: 'Launch a campaign', done: campaignCount > 0, href: '/campaigns', icon: Megaphone },
    { label: 'Track performance', done: false, href: '/performance', icon: BarChart3 },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back{profile?.name ? `, ${profile.name}` : ''}
        </h1>
        <p className="text-muted mt-1">
          {onTrial
            ? `${daysUntil(profile?.trial_ends_at || null)} days left on your ${plan.name} trial`
            : `${plan.name} plan · ${plan.priceDisplay}`}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Campaigns', value: campaignCount },
          { label: 'Ad Variants', value: adCount },
          { label: 'Plan', value: plan.name },
          { label: 'Meta Connected', value: adAccount ? 'Yes' : 'No' },
        ].map((stat) => (
          <div key={stat.label} className="meta-card p-4">
            <p className="text-sm text-[var(--muted)]">{stat.label}</p>
            <p className="text-2xl font-bold mt-1 text-[var(--foreground)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Next step CTA */}
      {!adAccount && (
        <div className="meta-card p-5 mb-6 border-[var(--meta-blue)]/30 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Step 1: Complete onboarding</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Add your website + competitors to start cloning ads</p>
          </div>
          <Link href="/onboarding" className="btn-primary text-sm shrink-0">Start onboarding →</Link>
        </div>
      )}
      {adAccount && adCount === 0 && (
        <div className="meta-card p-5 mb-6 border-[var(--meta-blue)]/30 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Step 2: Clone competitor ads</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Pick winning ads from the Ad Library and generate your versions</p>
          </div>
          <Link href="/ads" className="btn-primary text-sm shrink-0">Go to Ad Generation →</Link>
        </div>
      )}
      {adCount > 0 && campaignCount === 0 && (
        <div className="meta-card p-5 mb-6 border-[var(--meta-green)]/30 bg-green-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Step 3: Launch your first campaign</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Use a template, review the pre-flight checklist, and go live on Meta</p>
          </div>
          <Link href="/campaigns" className="btn-primary text-sm shrink-0">Launch campaign →</Link>
        </div>
      )}

      <div className="meta-card p-6">
        <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
        <div className="space-y-3">
          {steps.map(({ label, done, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-muted'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${done ? 'line-through text-muted' : ''}`}>{label}</p>
              </div>
              {!done && <span className="text-sm text-primary font-medium">Start →</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
