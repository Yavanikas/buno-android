import { computeQualitativeState } from '../utils/qualitative';
import { getBudgetState, getRemainingDays, type RiskLabel } from '../utils/spendingCalc';
import { getRecentPatternSummary, type PatternSummary } from '../utils/spendingPatterns';
import { getDeterministicAdvice, type AdvicePayload } from '../utils/spendingAdvice';
import { FALLBACK_PATTERN_INSIGHT, type PatternInsightPayload } from './ai/safety';
import { buildAdviceContext, getGroqAdvice } from './ai/groqAdvice';
import { getGroqPatternInsight } from './ai/groqPatternInsight';

const INCOME_CATEGORY = 'income';

export type ExpenseView = {
  amount: number;
  date: Date;
  category?: string;
  note?: string;
};

// Converts stored transactions into the qualitative-analysis expense view.
// Income is never a spending contributor and must not distort signals.
export function toExpenseView(transactions: any[]): ExpenseView[] {
  if (!Array.isArray(transactions)) {
    return [];
  }

  return transactions
    .filter((t) => String(t?.category || '').toLowerCase() !== INCOME_CATEGORY)
    .map((t) => ({
      amount: Number(t.amount),
      date: t.date instanceof Date ? t.date : new Date(t.date),
      category: t.category,
      note: t.note || undefined,
    }));
}

function getRemainingDaysForBudget(month: number, year: number): number {
  const monthEnd = new Date(year, month, 0);
  return getRemainingDays(new Date(), monthEnd);
}

function getAnalysis(budget: any, transactions: any[]) {
  const expenses = toExpenseView(transactions);
  const remainingDays = getRemainingDaysForBudget(budget.month, budget.year);
  const state = getBudgetState({
    totalBudget: Number(budget.monthlyLimit),
    expenses,
    remainingDays,
  });
  const patterns = getRecentPatternSummary(expenses, {
    riskLabel: state.riskLabel,
    daysRemaining: remainingDays,
    windowDays: 14,
  });

  return { expenses, remainingDays, state, patterns };
}

export type BudgetStateResponse = {
  budgetId: string;
  riskLabel: RiskLabel;
  zoneLabel: string;
  paceLabel: string;
  daysRemaining: number;
  expensesLogged: number;
  currency: string;
};

// State reuses the existing backend qualitative engine (utils/qualitative.ts)
// so the same risk/zone/pace conventions power every endpoint. Fully
// deterministic; the AI never touches /state.
export function buildStateResponse(budget: any, transactions: any[]): BudgetStateResponse {
  const expenses = toExpenseView(transactions);
  const qualitative = computeQualitativeState(
    Number(budget.monthlyLimit),
    budget.currency,
    expenses,
    budget.month,
    budget.year
  );

  return {
    budgetId: budget.id,
    riskLabel: qualitative.riskLabel.toLowerCase() as RiskLabel,
    zoneLabel: qualitative.zoneLabel,
    paceLabel: qualitative.paceLabel,
    daysRemaining: qualitative.daysRemaining,
    expensesLogged: qualitative.expensesLogged,
    currency: qualitative.currency,
  };
}

export type PatternsResponse = {
  budgetId: string;
  insight: PatternInsightPayload;
} & PatternSummary;

// Deterministic pattern extraction remains the source of truth. Groq adds a
// qualitative interpretation only when there is real activity; any failure
// falls back to the deterministic insight.
export async function buildPatternsResponse(budget: any, transactions: any[]): Promise<PatternsResponse> {
  const { patterns } = getAnalysis(budget, transactions);

  let insight: PatternInsightPayload = FALLBACK_PATTERN_INSIGHT;
  if (patterns.recentExpenseCount > 0) {
    insight = (await getGroqPatternInsight(patterns)) ?? FALLBACK_PATTERN_INSIGHT;
  }

  return {
    budgetId: budget.id,
    ...patterns,
    insight,
  };
}

// Advice prefers validated Groq output and always falls back to the
// deterministic qualitative advice keyed on risk when Groq is unavailable,
// unsafe, malformed, or unconfigured.
export async function buildAdviceResponse(budget: any, transactions: any[]): Promise<AdvicePayload> {
  const { remainingDays, state, patterns } = getAnalysis(budget, transactions);

  if (patterns.recentExpenseCount > 0) {
    const aiAdvice = await getGroqAdvice(
      buildAdviceContext({ state, patterns, daysRemaining: remainingDays })
    );
    if (aiAdvice) {
      return aiAdvice;
    }
  }

  return getDeterministicAdvice(state.riskLabel);
}
