import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';
import { Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--meta-blue)]" />
      </div>
    }>
      <OnboardingClient />
    </Suspense>
  );
}
