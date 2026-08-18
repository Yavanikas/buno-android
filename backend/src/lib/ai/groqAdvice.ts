import type { PatternSummary } from '../../utils/spendingPatterns';
import type { RiskLabel } from '../../utils/spendingCalc';
import { createGroqClient, type GroqClient, type GroqMessage } from './groqClient';
import { parseAdviceResponse, type AdvicePayload } from './safety';

export type AdviceContext = {
  riskLabel: RiskLabel;
  zoneLabel: string;
  paceLabel: string;
  daysRemaining: number;
  recentExpenseCount: number;
  uniqueCategoriesCount: number;
  topCategoryByFrequency: string;
  weekendExpenseCount: number;
  weekdayExpenseCount: number;
  hasRepeatedSmallPurchases: boolean;
  hasDominantCategory: boolean;
  appearsClusteredInLastFiveDays: boolean;
  spendingRhythm: string;
};

const SYSTEM_PROMPT = `You are Buno, a calm student budgeting assistant.
STRICT RULES:
- NEVER include exact currency amounts, numerical prices, exact remaining balance, budget remainders, digits (0-9), currency symbols ($, \u20b9, \u20ac, \u00a3, \u00a5), percentages, or "remaining balance"/"budget left" style wording.
- Describe behavioral patterns in qualitative terms only.
- Be calm, supportive, non-judgmental, and never anxiety-provoking. Do not scold.
- Only use evidence supplied in the user context. Never invent spending patterns or numbers.
- Never give exact spending recommendations tied to hidden monetary values.
Return ONLY a valid JSON object with exactly these string keys:
- "paceSummary": a short qualitative observation about recent spending pace (one sentence).
- "monthOutlook": a short qualitative observation about the rest of the month (one sentence).
- "todaySuggestion": a practical, friendly, non-numeric tip for today (one sentence).
Adapt tone to riskLabel: safe = reassuring and encouraging, watchful = gently cautious, fragile = clear and protective.`;

// Builds the compact qualitative context sent to Groq. Contains NO budget
// totals, spent amounts, remaining balances, or other hidden financial state.
export function buildAdviceContext(input: {
  state: { riskLabel: RiskLabel; zoneLabel: string; paceLabel: string };
  patterns: PatternSummary;
  daysRemaining: number;
}): AdviceContext {
  return {
    riskLabel: input.state.riskLabel,
    zoneLabel: input.state.zoneLabel,
    paceLabel: input.state.paceLabel,
    daysRemaining: input.daysRemaining,
    recentExpenseCount: input.patterns.recentExpenseCount,
    uniqueCategoriesCount: input.patterns.uniqueCategoriesCount,
    topCategoryByFrequency: input.patterns.topCategoryByFrequency,
    weekendExpenseCount: input.patterns.weekendExpenseCount,
    weekdayExpenseCount: input.patterns.weekdayExpenseCount,
    hasRepeatedSmallPurchases: input.patterns.hasRepeatedSmallPurchases,
    hasDominantCategory: input.patterns.hasDominantCategory,
    appearsClusteredInLastFiveDays: input.patterns.appearsClusteredInLastFiveDays,
    spendingRhythm: input.patterns.spendingRhythm,
  };
}

function buildMessages(context: AdviceContext): GroqMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Generate one cautious qualitative advice payload from this deterministic state.',
        context,
        responseShape: {
          paceSummary: 'string',
          monthOutlook: 'string',
          todaySuggestion: 'string',
        },
      }),
    },
  ];
}

// Returns validated AI advice, or null when Groq is unavailable, times out,
// returns malformed/unsafe content, or the key is missing.
export async function getGroqAdvice(
  context: AdviceContext,
  client: GroqClient = createGroqClient()
): Promise<AdvicePayload | null> {
  const result = await client.chat(buildMessages(context));
  if (!result.ok) {
    return null;
  }
  return parseAdviceResponse(result.content);
}
