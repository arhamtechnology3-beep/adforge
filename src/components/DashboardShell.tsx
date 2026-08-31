'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TrialBanner from '@/components/TrialBanner';
import TrialGate from '@/components/TrialGate';
import MetaReconnectBanner from '@/components/MetaReconnectBanner';
import type { User, AdAccount } from '@/types/database';

export default function DashboardShell({
  profile,
  adAccount,
  children,
}: {
  profile: User | null;
  adAccount: AdAccount | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-0 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <TrialBanner user={profile} />
          <MetaReconnectBanner adAccount={adAccount} />
          <TrialGate user={profile} pathname={pathname}>
            {children}
          </TrialGate>
        </div>
      </main>
    </div>
  );
}
