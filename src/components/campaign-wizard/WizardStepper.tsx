'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WizardStep = {
  id: string;
  label: string;
  shortLabel?: string;
};

export function WizardStepper({
  steps,
  currentStep,
  completedSteps,
}: {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 bg-[var(--meta-bg)]/95 backdrop-blur border-b border-[var(--border)] mb-6">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = completedSteps.has(i) || i < currentStep;
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0',
                    isActive && 'meta-step-active ring-4 ring-blue-100',
                    isDone && !isActive && 'meta-step-done',
                    !isDone && !isActive && 'meta-step-pending'
                  )}
                >
                  {isDone && !isActive ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-[10px] sm:text-xs font-medium text-center hidden sm:block truncate max-w-[72px]',
                    isActive ? 'text-[var(--meta-blue)]' : 'text-[var(--muted)]'
                  )}
                >
                  {step.shortLabel || step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 sm:mx-3 rounded',
                    isDone ? 'bg-[var(--meta-green)]' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
