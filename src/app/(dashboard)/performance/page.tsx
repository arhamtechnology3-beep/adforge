import { Suspense } from 'react';
import PerformanceClient from './PerformanceClient';
import { Loader2 } from 'lucide-react';

export default function PerformancePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <PerformanceClient />
    </Suspense>
  );
}
