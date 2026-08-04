import { Suspense } from 'react';
import OpsClient from './OpsClient';

export default function OpsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading Ops Agent…</div>}>
      <OpsClient />
    </Suspense>
  );
}
