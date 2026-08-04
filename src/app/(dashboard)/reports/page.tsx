import { Suspense } from 'react';
import ReportsClient from './ReportsClient';

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading reports…</div>}>
      <ReportsClient />
    </Suspense>
  );
}
