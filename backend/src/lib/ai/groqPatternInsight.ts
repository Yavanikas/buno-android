import type { PatternSummary } from '../../utils/spendingPatterns';
import { createGroqClient, type GroqClient, type GroqMessage } from './groqClient';
import { parsePatternInsightResponse, type PatternInsightPayload } from './safety';

const SYSTEM_PROMPT = `You are interpreting short-term spending patterns for a calm student budgeting assistant.
STRICT RULES:
- Never invent facts not supported by the supplied data.
- Never output exact currency amounts, exact remaining balance, budget remainders, digits (0-9), currency symbols, percentages, or exact spending ranges.
- Never assign the official risk state; that is decided deterministically elsewhere.
- Be qualitative, cautious, non-judgmental, and never scolding.
Return ONLY a valid JSON object with exactly these keys:
- "patternTag": one of "Weekend pattern", "Category clustering", "Repeat small spends", "Late-cycle pressure", or "Recent activity".
- "insight": exactly one qualitative, cautious sentence. Prefer phrases like "seems", "tends to", or "appears". If the data is weak, return a generic low-confidence observation instead of inventing a strong pattern. Stay under 24 words, avoid exact numbers and scolding language.
- "confidence": one of "low", "medium", or "high".`;

// Wraps the deterministic pattern summary (source of truth) so Groq only adds a
// qualitative interpretation. The summary itself never contains monetary amounts.
export function buildPatternInsightContext(summary: PatternSummary): Record<string, unknown> {
  return {
    task: 'Generate one cautious qualitative spending pattern insight from this deterministic summary.',
    summary,
    responseShape: {
      patternTag: [
        'Weekend pattern',
        'Category clustering',
        'Repeat small spends',
        'Late-cycle pressure',
        'Recent activity',
      ],
      insight: 'one qualitative sentence, no exact numbers or currency amounts',
      confidence: ['low', 'medium', 'high'],
    },
  };
}

function buildMessages(summary: PatternSummary): GroqMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(buildPatternInsightContext(summary)) },
  ];
}

// Returns validated AI pattern interpretation, or null on any failure so the
// caller can fall back to the deterministic insight.
export async function getGroqPatternInsight(
  summary: PatternSummary,
  client: GroqClient = createGroqClient()
): Promise<PatternInsightPayload | null> {
  const result = await client.chat(buildMessages(summary));
  if (!result.ok) {
    return null;
  }
  return parsePatternInsightResponse(result.content);
}
