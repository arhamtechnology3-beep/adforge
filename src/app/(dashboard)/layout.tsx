import DashboardShell from '@/components/DashboardShell';
import { createClient } from '@/lib/supabase/server';
import type { User, AdAccount } from '@/types/database';
import { cookies } from 'next/headers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile: User | null = null;
  let adAccount: AdAccount | null = null;

  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      profile = data;

      const { data: account } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('user_id', authUser.id)
        .single();
      adAccount = account;
    }
  } catch {
    // Network / Supabase offline fallback
  }

  const cookieStore = await cookies();
  const isDemo = cookieStore.get('demo_session')?.value === 'true';

  if (!profile && isDemo) {
    profile = {
      id: 'demo-user-id',
      email: 'jesalp85@gmail.com',
      name: 'Jesal',
      plan_tier: 'growth',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    } as unknown as User;
  }

  return (
    <DashboardShell profile={profile} adAccount={adAccount}>
      {children}
    </DashboardShell>
  );
}
