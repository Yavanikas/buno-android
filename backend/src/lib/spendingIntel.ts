import { computeQualitativeState } from '../utils/qualitative';
import { getBudgetState, getRemainingDays, type RiskLabel } from '../utils/spendingCalc';
import { getRecentPatternSummary, type PatternSummary } from '../utils/spendingPatterns';
import { getDeterministicAdvice, type AdvicePayload } from '../utils/spendingAdvice';

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
} & PatternSummary;

// Deterministic pattern extraction is the source of truth. It reveals which
// behaviour stood out this month and never exposes amounts or balances.
export function buildPatternsResponse(budget: any, transactions: any[]): PatternsResponse {
  const { patterns } = getAnalysis(budget, transactions);

  return {
    budgetId: budget.id,
    ...patterns,
  };
}

// Advice is derived deterministically from the qualitative state, keyed on the
// risk label. It never contains amounts, percentages, or remaining balances.
export function buildAdviceResponse(budget: any, transactions: any[]): AdvicePayload {
  const { state } = getAnalysis(budget, transactions);

  return getDeterministicAdvice(state.riskLabel);
}
