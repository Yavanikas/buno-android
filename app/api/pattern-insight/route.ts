import type { RiskLabel } from '../../../lib/calc';
import { getRecentPatternSummary, type PatternExpense, type PatternSummary } from '../../../lib/patterns';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TIMEOUT_MS = 10_000;
const GROQ_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = `You are interpreting short-term spending patterns.
You are not allowed to invent facts not supported by the supplied data.
You are not allowed to output exact currency amounts, exact remaining balance, or exact spending ranges.
You are not allowed to assign the official risk state.
You must return only JSON with patternTag, insight, and confidence.
The insight must be one sentence only.
The insight must be qualitative, cautious, and non-judgmental.
Prefer phrases like "seems", "tends to", or "appears".
If the data is weak, return a generic low-confidence observation instead of inventing a strong pattern.
Allowed patternTag values are "Weekend pattern", "Category clustering", "Repeat small spends", "Late-cycle pressure", and "Recent activity".
The insight must stay under 24 words if possible, avoid exact numbers, and avoid scolding language.`;

const FALLBACK_PATTERN_INSIGHT: PatternInsightResponse = {
  patternTag: 'Recent activity',
  insight: 'Recent spending activity is worth watching over the next few days.',
  confidence: 'low',
};

const ALLOWED_PATTERN_TAGS = [
  'Weekend pattern',
  'Category clustering',
  'Repeat small spends',
  'Late-cycle pressure',
  'Recent activity',
] as const;

const ALLOWED_CONFIDENCE = ['low', 'medium', 'high'] as const;

type PatternTag = (typeof ALLOWED_PATTERN_TAGS)[number];
type PatternConfidence = (typeof ALLOWED_CONFIDENCE)[number];

type PatternInsightRequestBody = {
  riskLabel?: RiskLabel;
  recentExpenses?: PatternExpense[];
  daysRemaining?: number;
};

type PatternInsightResponse = {
  patternTag: string;
  insight: string;
  confidence: PatternConfidence;
};

type OpenAIResponse = {
  output_text?: string;
};

export async function POST(request: Request) {
  const parsedBody = await parseRequestBody(request);

  if (!parsedBody) {
    logDevelopmentError('Invalid pattern insight request body');
    return fallbackResponse();
  }

  const summary = getRecentPatternSummary(parsedBody.recentExpenses, {
    riskLabel: parsedBody.riskLabel,
    daysRemaining: parsedBody.daysRemaining,
    windowDays: 14,
  });

  if (summary.recentExpenseCount === 0) {
    return fallbackResponse();
  }

  let rawInsightOutput: string | undefined;

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (openAiApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-5.6',
          instructions: SYSTEM_PROMPT,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify(buildModelContext(summary)),
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as OpenAIResponse;
        rawInsightOutput = data.output_text;
      } else {
        const errorBody = await response.text();
        logDevelopmentError('OpenAI pattern insight API error', {
          status: response.status,
          body: errorBody,
        });
      }
    } catch (error) {
      logDevelopmentError('OpenAI pattern insight request failed', error);
    } finally {
      clearTimeout(timeout);
    }
  } else {
    logDevelopmentError('Missing OPENAI_API_KEY for pattern insight');
  }

  // Fallback to Groq API if OpenAI fails or returned empty
  if (!rawInsightOutput) {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: 'llama3-8b-8192', // Replace with desired Groq model
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify(buildModelContext(summary)) },
            ],
            response_format: { type: 'json_object' }
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          rawInsightOutput = data?.choices?.[0]?.message?.content;
        } else {
          const errorBody = await response.text();
          logDevelopmentError('Groq pattern insight API error', {
            status: response.status,
            body: errorBody,
          });
        }
      } catch (error) {
        logDevelopmentError('Groq pattern insight request failed', error);
      } finally {
        clearTimeout(timeout);
      }
    } else {
      logDevelopmentError('Missing GROQ_API_KEY for pattern insight');
    }
  }

  if (!rawInsightOutput) {
    return fallbackResponse();
  }

  const insight = toSafePatternInsight(rawInsightOutput);
  return Response.json(insight);
}

async function parseRequestBody(request: Request): Promise<PatternInsightRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;

    if (!isRecord(body)) {
      return null;
    }

    return {
      riskLabel: isRiskLabel(body.riskLabel) ? body.riskLabel : 'watchful',
      recentExpenses: Array.isArray(body.recentExpenses) ? body.recentExpenses : [],
      daysRemaining: typeof body.daysRemaining === 'number' ? body.daysRemaining : undefined,
    };
  } catch (error) {
    logDevelopmentError('Failed to parse pattern insight request JSON', error);
    return null;
  }
}

function buildModelContext(summary: PatternSummary) {
  return {
    task: 'Generate one cautious qualitative spending pattern insight from this deterministic summary.',
    summary,
    responseShape: {
      patternTag: ALLOWED_PATTERN_TAGS,
      insight: 'one qualitative sentence, no exact numbers or rupee amounts',
      confidence: ALLOWED_CONFIDENCE,
    },
  };
}

function toSafePatternInsight(value: unknown): PatternInsightResponse {
  if (typeof value !== 'string') {
    logDevelopmentError('OpenAI pattern insight output was not text');
    return FALLBACK_PATTERN_INSIGHT;
  }

  try {
    const parsed = JSON.parse(value.trim()) as unknown;

    if (!isRecord(parsed)) {
      return FALLBACK_PATTERN_INSIGHT;
    }

    const patternTag = toSafePatternTag(parsed.patternTag);
    const insight = toSafeInsight(parsed.insight);
    const confidence = toSafeConfidence(parsed.confidence);

    return {
      patternTag,
      insight,
      confidence,
    };
  } catch (error) {
    logDevelopmentError('Failed to parse OpenAI pattern insight JSON', error);
    return FALLBACK_PATTERN_INSIGHT;
  }
}

function toSafePatternTag(value: unknown): PatternTag {
  return typeof value === 'string' && isPatternTag(value) ? value : 'Recent activity';
}

function toSafeInsight(value: unknown): string {
  if (typeof value !== 'string') {
    return FALLBACK_PATTERN_INSIGHT.insight;
  }

  const insight = value.trim();

  if (!insight || containsExactAmount(insight) || isBrokenText(insight)) {
    return FALLBACK_PATTERN_INSIGHT.insight;
  }

  return insight;
}

function toSafeConfidence(value: unknown): PatternConfidence {
  return typeof value === 'string' && isConfidence(value) ? value : FALLBACK_PATTERN_INSIGHT.confidence;
}

function containsExactAmount(value: string): boolean {
  return /[$₹]|\brs\.?\b|\brupees?\b|\busd\b|\bdollars?\b|\bcents?\b|\d/.test(value.toLowerCase());
}

function isBrokenText(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return normalizedValue === 'undefined' || normalizedValue === 'null' || normalizedValue === 'nan';
}

function isPatternTag(value: string): value is PatternTag {
  return ALLOWED_PATTERN_TAGS.includes(value as PatternTag);
}

function isConfidence(value: string): value is PatternConfidence {
  return ALLOWED_CONFIDENCE.includes(value as PatternConfidence);
}

function isRiskLabel(value: unknown): value is RiskLabel {
  return value === 'safe' || value === 'watchful' || value === 'fragile';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fallbackResponse(): Response {
  return Response.json(FALLBACK_PATTERN_INSIGHT);
}

function logDevelopmentError(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  if (error === undefined) {
    console.error(message);
    return;
  }

  console.error(message, error);
}
