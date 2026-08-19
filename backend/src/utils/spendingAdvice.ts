import type { RiskLabel } from './spendingCalc';

export type AdvicePayload = {
  paceSummary: string;
  monthOutlook: string;
  todaySuggestion: string;
  advice: string;
};

const SAFE_ADVICE: AdvicePayload = {
  paceSummary: "You're spending slower than usual this week.",
  monthOutlook: 'At this pace, the rest of the month looks comfortable.',
  todaySuggestion: 'Keep your momentum going with a light day today.',
  advice: "You're spending slower than usual this week. At this pace, the rest of the month looks comfortable.",
};

const WATCHFUL_ADVICE: AdvicePayload = {
  paceSummary: "You're keeping a balanced pace so far.",
  monthOutlook: 'At this pace, your monthly setup remains on track.',
  todaySuggestion: 'Keep an eye on your pace today to keep plenty of flexibility.',
  advice: "You're keeping a balanced pace so far. At this pace, your monthly setup remains on track.",
};

const FRAGILE_ADVICE: AdvicePayload = {
  paceSummary: 'Spending has been running a little ahead of the usual pace.',
  monthOutlook: 'The rest of the month will need a bit of extra care.',
  todaySuggestion: 'Pick one optional spend to skip today to protect your flexibility.',
  advice: 'Spending has been running a little ahead of the usual pace. The rest of the month will need a bit of extra care.',
};

// Deterministic fallback advice keyed on the qualitative risk label.
// Groq/OpenAI wiring happens in STEP 4B; this service keeps the contract ready for it.
export function getDeterministicAdvice(riskLabel: RiskLabel): AdvicePayload {
  if (riskLabel === 'safe') {
    return SAFE_ADVICE;
  }

  if (riskLabel === 'fragile') {
    return FRAGILE_ADVICE;
  }

  return WATCHFUL_ADVICE;
}