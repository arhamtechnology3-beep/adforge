'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { isTokenExpired } from '@/lib/meta';
import type { AdAccount } from '@/types/database';

interface MetaReconnectBannerProps {
  adAccount: AdAccount | null;
}

export default function MetaReconnectBanner({ adAccount }: MetaReconnectBannerProps) {
  if (!adAccount?.access_token_encrypted) return null;

  const expired = isTokenExpired(adAccount.token_expires_at);

  if (!expired) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-red-800">Meta account connection expired</p>
        <p className="text-sm text-red-600 mt-0.5">
          Reconnect your Meta ad account to continue launching and managing campaigns.
        </p>
      </div>
      <Link href="/api/oauth/meta/connect" className="btn-primary text-sm whitespace-nowrap">
        Reconnect
      </Link>
    </div>
  );
}
