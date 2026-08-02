import Sidebar from '@/components/Sidebar';
import TrialBanner from '@/components/TrialBanner';
import MetaReconnectBanner from '@/components/MetaReconnectBanner';
import { createClient } from '@/lib/supabase/server';
import type { User, AdAccount } from '@/types/database';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let profile: User | null = null;
  let adAccount: AdAccount | null = null;

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-0 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <TrialBanner user={profile} />
          <MetaReconnectBanner adAccount={adAccount} />
          {children}
        </div>
      </main>
    </div>
  );
}
