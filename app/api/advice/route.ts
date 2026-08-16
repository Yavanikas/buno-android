import type { BudgetState } from '../../../lib/calc';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const SYSTEM_PROMPT = `You are Buno, a calm student budgeting assistant.
STRICT RULE: You must NEVER include any exact currency amounts, numerical prices, exact remaining balance, digits (0-9), or currency symbols ($ or ₹).
Return ONLY a valid JSON object with the following string keys:
- "paceSummary": A short observation about weekly spending speed (e.g. "You're spending slower than usual this week.").
- "monthOutlook": A short observation about the month's outlook (e.g. "At this pace, the rest of the month looks comfortable.").
- "todaySuggestion": A practical, friendly tip for today (e.g. "Skip one unnecessary food delivery and you'll keep plenty of flexibility.").

Adapt tone to riskLabel: safe = reassuring and encouraging, watchful = gently cautious, fragile = clear and protective.`;

const FALLBACK_ADVICE_PAYLOAD = {
  paceSummary: "You're keeping a balanced pace so far.",
  monthOutlook: "At this pace, your monthly setup remains on track.",
  todaySuggestion: "Keep an eye on your pace today to keep plenty of flexibility.",
  advice: "Keep an eye on your pace today to keep plenty of flexibility.",
};
const OPENAI_TIMEOUT_MS = 10_000;
const GROQ_TIMEOUT_MS = 10_000;

type RiskLabel = BudgetState['riskLabel'];

type AdviceRequestBody = {
  riskLabel?: RiskLabel;
  zoneLabel?: BudgetState['zoneLabel'];
  paceLabel?: BudgetState['paceLabel'];
};

type SafeAdviceContext = {
  riskLabel: RiskLabel;
  zoneLabel: BudgetState['zoneLabel'];
  paceLabel: BudgetState['paceLabel'];
};

type OpenAIResponse = {
  output_text?: string;
};

export async function POST(request: Request) {
  const parsedBody = await parseRequestBody(request);

  if (!parsedBody) {
    logDevelopmentError('Invalid advice request body');
    return fallbackResponse();
  }

  const safeContext = toSafeAdviceContext(parsedBody);

  let rawText: string | undefined;

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
                  text: JSON.stringify(safeContext),
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as OpenAIResponse;
        rawText = data.output_text?.trim();
      } else {
        const errorBody = await response.text();
        logDevelopmentError('OpenAI API error', {
          status: response.status,
          body: errorBody,
        });
      }
    } catch (error) {
      logDevelopmentError('OpenAI advice request failed', error);
    } finally {
      clearTimeout(timeout);
    }
  } else {
    logDevelopmentError('Missing OPENAI_API_KEY');
  }

  // Fallback to Groq API if OpenAI fails or returned empty
  if (!rawText) {
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
            model: 'llama3-8b-8192',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify(safeContext) },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          rawText = data?.choices?.[0]?.message?.content?.trim();
        } else {
          const errorBody = await response.text();
          logDevelopmentError('Groq API error', {
            status: response.status,
            body: errorBody,
          });
        }
      } catch (error) {
        logDevelopmentError('Groq advice request failed', error);
      } finally {
        clearTimeout(timeout);
      }
    } else {
      logDevelopmentError('Missing GROQ_API_KEY');
    }
  }

  if (!rawText) {
    logDevelopmentError('Both APIs failed or returned empty advice');
    return fallbackResponse();
  }

  if (containsExactAmount(rawText)) {
    logDevelopmentError('API returned advice with exact numeric content');
    return fallbackResponse();
  }

  try {
    const parsed = JSON.parse(rawText);
    const paceSummary = typeof parsed.paceSummary === 'string' && !containsExactAmount(parsed.paceSummary) ? parsed.paceSummary : FALLBACK_ADVICE_PAYLOAD.paceSummary;
    const monthOutlook = typeof parsed.monthOutlook === 'string' && !containsExactAmount(parsed.monthOutlook) ? parsed.monthOutlook : FALLBACK_ADVICE_PAYLOAD.monthOutlook;
    const todaySuggestion = typeof parsed.todaySuggestion === 'string' && !containsExactAmount(parsed.todaySuggestion) ? parsed.todaySuggestion : FALLBACK_ADVICE_PAYLOAD.todaySuggestion;
    const advice = `${paceSummary} ${monthOutlook}`;

    return Response.json({
      paceSummary,
      monthOutlook,
      todaySuggestion,
      advice,
    });
  } catch {
    // If rawText wasn't valid JSON, fallback to standard payload
    return Response.json({
      ...FALLBACK_ADVICE_PAYLOAD,
      advice: rawText,
    });
  }
}

async function parseRequestBody(request: Request): Promise<AdviceRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;

    if (!isRecord(body)) {
      return null;
    }

    return body;
  } catch (error) {
    logDevelopmentError('Failed to parse advice request JSON', error);
    return null;
  }
}

function toSafeAdviceContext(body: AdviceRequestBody): SafeAdviceContext {
  return {
    riskLabel: isRiskLabel(body.riskLabel) ? body.riskLabel : 'watchful',
    zoneLabel: isZoneLabel(body.zoneLabel) ? body.zoneLabel : 'You are keeping a steady pace.',
    paceLabel: isPaceLabel(body.paceLabel) ? body.paceLabel : 'Things are getting tighter.',
  };
}

function isRecord(value: unknown): value is AdviceRequestBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRiskLabel(value: unknown): value is RiskLabel {
  return value === 'safe' || value === 'watchful' || value === 'fragile';
}

function isZoneLabel(value: unknown): value is BudgetState['zoneLabel'] {
  return value === "You're pacing yourself well." || value === 'You are keeping a steady pace.' || value === 'Take it easy on spending.';
}

function isPaceLabel(value: unknown): value is BudgetState['paceLabel'] {
  return (
    value === 'You have some flexibility.' ||
    value === 'Things are getting tighter.' ||
    value === 'Flexibility is limited.'
  );
}

function containsExactAmount(value: string): boolean {
  return /[$₹]|\brs\.?\b|\brupees?\b|\busd\b|\bdollars?\b|\bcents?\b|\d/.test(value.toLowerCase());
}

function fallbackResponse(): Response {
  return Response.json(FALLBACK_ADVICE_PAYLOAD);
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
