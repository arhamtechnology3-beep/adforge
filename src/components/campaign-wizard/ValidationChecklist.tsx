'use client';

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { ValidationItem } from '@/lib/campaign-validation';
import { cn } from '@/lib/utils';

export function ValidationChecklist({
  items,
  loading,
}: {
  items: ValidationItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="meta-card p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const passCount = items.filter((i) => i.status === 'pass').length;
  const failCount = items.filter((i) => i.status === 'fail').length;

  return (
    <div className="meta-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--foreground)]">Pre-launch checklist</h3>
        <span className="text-xs text-[var(--muted)]">
          {passCount}/{items.length} passed
          {failCount > 0 && (
            <span className="text-[var(--danger)] ml-1">· {failCount} blocking</span>
          )}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-start gap-2.5 text-sm rounded-lg px-3 py-2',
              item.status === 'pass' && 'bg-green-50',
              item.status === 'warn' && 'bg-amber-50',
              item.status === 'fail' && 'bg-red-50'
            )}
          >
            {item.status === 'pass' && (
              <CheckCircle2 className="w-4 h-4 text-[var(--meta-green)] shrink-0 mt-0.5" />
            )}
            {item.status === 'warn' && (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            )}
            {item.status === 'fail' && (
              <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-[var(--foreground)]">{item.label}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">{item.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
