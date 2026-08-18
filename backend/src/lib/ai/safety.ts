export type AdvicePayload = {
  paceSummary: string;
  monthOutlook: string;
  todaySuggestion: string;
  advice: string;
};

export type PatternInsightPayload = {
  patternTag: string;
  insight: string;
  confidence: 'low' | 'medium' | 'high';
};

export const ALLOWED_PATTERN_TAGS = [
  'Weekend pattern',
  'Category clustering',
  'Repeat small spends',
  'Late-cycle pressure',
  'Recent activity',
] as const;

export const ALLOWED_CONFIDENCE = ['low', 'medium', 'high'] as const;

// Deterministic, amount-free fallback for the pattern interpretation.
export const FALLBACK_PATTERN_INSIGHT: PatternInsightPayload = {
  patternTag: 'Recent activity',
  insight: 'Recent spending activity is worth watching over the next few days.',
  confidence: 'low',
};

const MAX_FIELD_LENGTH = 300;

// Robust leakage detection for AI-generated qualitative insight. Blocks:
//   - currency symbols, currency codes/words used monetarily
//   - any digits (exact amounts, percentages, daily spending limits)
//   - remaining-balance / budget-remainder wording
//   - percentage phrasing that could reveal hidden financial state
export function detectLeakage(text: string): boolean {
  if (typeof text !== 'string' || !text.trim()) {
    return true;
  }

  if (/[$₹€£¥]/.test(text)) {
    return true;
  }

  const lower = text.toLowerCase();

  if (/\b(?:rs\.?|inr|usd|eur|gbp|rupees?|dollars?|cents?|pounds?|euros?|yen|yuan|taka)\b/.test(lower)) {
    return true;
  }

  if (/\d/.test(text)) {
    return true;
  }

  if (
    /\b(?:remaining balance|remaining budget|budget left|money left|balance left|left to spend|left in your budget|budget remains|budget remainder|remaining amount|account balance|left over|still remaining)\b/.test(
      lower
    )
  ) {
    return true;
  }

  if (/\b(?:percent|percentage)\b/.test(lower)) {
    return true;
  }

  return false;
}

// Never trust raw Groq output: parse + validate before anything is returned.
export function parseAdviceResponse(raw: unknown): AdvicePayload | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return null;
  }

  const paceSummary = toSafeField(parsed.paceSummary);
  const monthOutlook = toSafeField(parsed.monthOutlook);
  const todaySuggestion = toSafeField(parsed.todaySuggestion);

  if (paceSummary === null || monthOutlook === null || todaySuggestion === null) {
    return null;
  }

  return {
    paceSummary,
    monthOutlook,
    todaySuggestion,
    advice: `${paceSummary} ${monthOutlook}`,
  };
}

export function parsePatternInsightResponse(raw: unknown): PatternInsightPayload | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return null;
  }

  const patternTag = typeof parsed.patternTag === 'string' ? parsed.patternTag.trim() : '';
  const insight = toSafeField(parsed.insight);
  const confidence = typeof parsed.confidence === 'string' ? parsed.confidence.trim() : '';

  if (!isAllowedPatternTag(patternTag) || insight === null || !isAllowedConfidence(confidence)) {
    return null;
  }

  return { patternTag, insight, confidence };
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isRecord(parsed) ? parsed : null;
}

function toSafeField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_FIELD_LENGTH) {
    return null;
  }

  if (detectLeakage(trimmed)) {
    return null;
  }

  return trimmed;
}

function isAllowedPatternTag(value: string): boolean {
  return (ALLOWED_PATTERN_TAGS as readonly string[]).includes(value);
}

function isAllowedConfidence(value: string): value is 'low' | 'medium' | 'high' {
  return (ALLOWED_CONFIDENCE as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
