import { Suspense } from 'react';
import OptimizeClient from './OptimizeClient';

export default function OptimizePage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading Optimize…</div>}>
      <OptimizeClient />
    </Suspense>
  );
}
