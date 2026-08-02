import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Rocket, Sparkles, Megaphone, BarChart3 } from 'lucide-react';
import { getPlan } from '@/lib/plans';
import { daysUntil, isTrialActive } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { count: campaignCount } = await supabase
    .from('meta_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id);

  const { count: adCount } = await supabase
    .from('generated_ads')
    .select('*, campaigns_input!inner(*)', { count: 'exact', head: true })
    .eq('campaigns_input.user_id', user!.id);

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  const plan = getPlan(profile?.plan_tier || 'starter');
  const onTrial = isTrialActive(profile?.trial_ends_at || null);

  const steps = [
    { label: 'Complete onboarding', done: !!adAccount, href: '/onboarding', icon: Rocket },
    { label: 'Generate ad creatives', done: (adCount || 0) > 0, href: '/ads', icon: Sparkles },
    { label: 'Launch a campaign', done: (campaignCount || 0) > 0, href: '/campaigns', icon: Megaphone },
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
          { label: 'Campaigns', value: campaignCount || 0 },
          { label: 'Ad Variants', value: adCount || 0 },
          { label: 'Plan', value: plan.name },
          { label: 'Meta Connected', value: adAccount ? 'Yes' : 'No' },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
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
