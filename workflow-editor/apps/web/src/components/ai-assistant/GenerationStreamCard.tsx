'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Loader2,
  Circle,
  Search,
  Cpu,
  GitBranch,
  Sparkles,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

interface StreamStep {
  id: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'pending' | 'active' | 'complete';
}

const STEP_DEFINITIONS = [
  { id: 'analyze', label: 'Analyzing request', detail: 'Understanding intent and context', icon: Search, delay: 0 },
  { id: 'services', label: 'Identifying services', detail: 'Matching tools and APIs', icon: Zap, delay: 1200 },
  { id: 'connections', label: 'Building connections', detail: 'Planning data flow between services', icon: GitBranch, delay: 2600 },
  { id: 'generate', label: 'Generating automation', detail: 'Creating executable workflow', icon: Sparkles, delay: 4000 },
];

interface GenerationStreamCardProps {
  isActive: boolean;
}

export function GenerationStreamCard({ isActive }: GenerationStreamCardProps) {
  const [steps, setSteps] = useState<StreamStep[]>(
    STEP_DEFINITIONS.map((s) => ({ ...s, status: 'pending' as const }))
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasBeenActive = useRef(false);

  useEffect(() => {
    if (isActive) {
      hasBeenActive.current = true;
      // Reset all to pending
      setSteps(STEP_DEFINITIONS.map((s) => ({ ...s, status: 'pending' as const })));

      // Progressively activate each step
      STEP_DEFINITIONS.forEach((stepDef, index) => {
        const timer = setTimeout(() => {
          setSteps((prev) =>
            prev.map((s, i) => {
              if (i < index) return { ...s, status: 'complete' as const };
              if (i === index) return { ...s, status: 'active' as const };
              return s;
            })
          );
        }, stepDef.delay);
        timersRef.current.push(timer);
      });

      return () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      };
    } else if (hasBeenActive.current) {
      // Complete all steps when loading ends
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'complete' as const })));
    }
  }, [isActive]);

  return (
    <div className="generation-stream-card animate-fade-in">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border/40">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Cpu className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground">Building automation</span>
        {isActive && (
          <div className="ml-auto flex gap-0.5">
            <span className="generation-stream-pulse" />
            <span className="generation-stream-pulse" style={{ animationDelay: '0.15s' }} />
            <span className="generation-stream-pulse" style={{ animationDelay: '0.3s' }} />
          </div>
        )}
        {!isActive && hasBeenActive.current && (
          <div className="ml-auto">
            <Check className="w-4 h-4 text-green-500" />
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const show = step.status !== 'pending';

          return (
            <div
              key={step.id}
              className={clsx(
                'generation-stream-step',
                step.status === 'pending' && 'generation-stream-step--pending',
                step.status === 'active' && 'generation-stream-step--active',
                step.status === 'complete' && 'generation-stream-step--complete',
              )}
            >
              {/* Status indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {step.status === 'complete' && (
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-500" />
                  </div>
                )}
                {step.status === 'active' && (
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  </div>
                )}
                {step.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center">
                    <Circle className="w-2 h-2 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Label + detail */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon
                    className={clsx(
                      'w-3.5 h-3.5 flex-shrink-0',
                      step.status === 'active' && 'text-primary',
                      step.status === 'complete' && 'text-muted-foreground',
                      step.status === 'pending' && 'text-muted-foreground/40',
                    )}
                  />
                  <span
                    className={clsx(
                      'text-sm',
                      step.status === 'active' && 'text-foreground font-medium',
                      step.status === 'complete' && 'text-muted-foreground',
                      step.status === 'pending' && 'text-muted-foreground/40',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {step.status === 'active' && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5.5 animate-fade-in">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
