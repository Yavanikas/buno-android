'use client';

import { useEffect, useState } from 'react';
import type { BudgetState } from '../lib/calc';

type RiskLabel = BudgetState['riskLabel'];
type ZoneLabel = BudgetState['zoneLabel'];
type PaceLabel = BudgetState['paceLabel'];

type ProbabilityWindowProps = { 
  riskLabel: RiskLabel;
  zoneLabel?: ZoneLabel;
  paceLabel?: PaceLabel;
  [unusedProp: string]: unknown;
};

type AdviceResponse = {
  advice?: string;
};

type RiskBadgeStyle = {
  label: string;
  className: string;
};

const FALLBACK_ADVICE = 'Keep an eye on your pace today.';

const riskBadgeStyles: Record<RiskLabel, RiskBadgeStyle> = {
  safe: {
    label: 'Safe',
    className: 'text-green-700',
  },
  watchful: {
    label: 'Watchful',
    className: 'text-yellow-700',
  },
  fragile: {
    label: 'Fragile',
    className: 'text-red-700',
  },
};

const zoneLabels: Record<RiskLabel, ZoneLabel> = {
  safe: "You're pacing yourself well.",
  watchful: 'You are keeping a steady pace.',
  fragile: 'Take it easy on spending.',
};

const paceLabels: Record<RiskLabel, PaceLabel> = {
  safe: 'You have some flexibility.',
  watchful: 'Things are getting tighter.',
  fragile: 'Flexibility is limited.',
};

export default function ProbabilityWindow({
  riskLabel,
  zoneLabel,
  paceLabel,
}: ProbabilityWindowProps) {
  const [advice, setAdvice] = useState<string>(FALLBACK_ADVICE);
  const [isLoading, setIsLoading] = useState(true);
  const safeRiskLabel = isRiskLabel(riskLabel) ? riskLabel : 'watchful';
  const safeZoneLabel = toSafeLabel(zoneLabel, zoneLabels[safeRiskLabel]);
  const safePaceLabel = toSafeLabel(paceLabel, paceLabels[safeRiskLabel]);
  const riskBadge = riskBadgeStyles[safeRiskLabel];

  useEffect(() => {
    let isMounted = true;

    async function loadAdvice() {
      setIsLoading(true);

      try {
        const response = await fetch('/api/advice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            riskLabel: safeRiskLabel,
            zoneLabel: safeZoneLabel,
            paceLabel: safePaceLabel,
          }),
        });

        if (!response.ok) {
          throw new Error('Advice request failed');
        }

        const data = (await response.json()) as AdviceResponse;
        const nextAdvice = toSafeAdvice(data.advice);

        if (isMounted) {
          setAdvice(nextAdvice);
        }
      } catch {
        if (isMounted) {
          setAdvice(FALLBACK_ADVICE);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAdvice();

    return () => {
      isMounted = false;
    };
  }, [riskLabel, zoneLabel, paceLabel]);

  if (isLoading) {
    return <ProbabilityWindowSkeleton />;
  }

  return (
    <section className="border-b-2 border-dotted border-[#c8bba9] pb-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-prose flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-[#3a2118]">How you&apos;re doing today</h2>
            <p className="font-serif text-3xl italic text-[#3a2118]">{safeZoneLabel}</p>
            <p className="text-sm font-semibold text-[#7d6253]">{safePaceLabel}</p>
          </div>

          <p className="max-w-prose text-sm leading-6 text-[#735747]">{advice}</p>
        </div>

        <div
          className={`text-sm font-bold uppercase tracking-widest flex items-center gap-1.5 ${riskBadge.className}`}
          aria-label={`Current spending risk: ${riskBadge.label}`}
        >
          <span aria-hidden="true">●</span> {riskBadge.label}
        </div>
      </div>
    </section>
  );
}

function isRiskLabel(value: unknown): value is RiskLabel {
  return value === 'safe' || value === 'watchful' || value === 'fragile';
}

function toSafeLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const label = value.trim();

  if (!label || isBrokenText(label) || containsExactAmount(label)) {
    return fallback;
  }

  return label;
}

function toSafeAdvice(value: unknown): string {
  return toSafeLabel(value, FALLBACK_ADVICE);
}

function isBrokenText(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return normalizedValue === 'undefined' || normalizedValue === 'null' || normalizedValue === 'nan';
}

function containsExactAmount(value: string): boolean {
  return /[$₹]|\brs\.?\b|\brupees?\b|\busd\b|\bdollars?\b|\bcents?\b|\d/.test(value.toLowerCase());
}

function ProbabilityWindowSkeleton() {
  return (
    <section
      className="border-b-2 border-dotted border-[#c8bba9] pb-8"
      aria-label="Loading today's spending window"
    >
      <div className="flex animate-pulse flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-5 w-48 rounded bg-[#ead9c8]" />
            <div className="h-8 w-44 rounded bg-[#ead9c8]" />
            <div className="h-4 w-40 rounded bg-[#ead9c8]" />
          </div>

          <div className="h-4 max-w-prose rounded bg-[#ead9c8]" />
        </div>

        <div className="h-5 w-20 rounded bg-[#ead9c8]" />
      </div>
    </section>
  );
}
