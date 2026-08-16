export type Expense = {
  amount: number;
  date: Date | string;
};

export type SafetyRange = {
  low: number;
  high: number;
};

export type RiskLabel = 'safe' | 'watchful' | 'fragile';

export type BudgetStateInput = {
  totalBudget?: number;
  expenses?: Expense[];
  remainingDays?: number;
};

export type BudgetState = {
  riskLabel: RiskLabel;
  zoneLabel: "You're pacing yourself well." | 'You are keeping a steady pace.' | 'Take it easy on spending.';
  paceLabel: 'You have some flexibility.' | 'Things are getting tighter.' | 'Flexibility is limited.';
};


// Combines the budget numbers into safe, simple labels for the UI.
export function getBudgetState(input: BudgetStateInput = {}): BudgetState {
  const expenses = Array.isArray(input.expenses) ? input.expenses : [];
  const totalBudget = Math.max(0, toSafeNumber(input.totalBudget));
  const spentSoFar = getSpentSoFar(expenses);
  const rawRemainingBudget = totalBudget - spentSoFar;
  const remainingBudget = getRemainingBudget(totalBudget, spentSoFar);
  const remainingDays = Math.max(0, Math.floor(toSafeNumber(input.remainingDays)));

  if (rawRemainingBudget <= 0 || remainingDays <= 0) {
    return getQualitativeBudgetState('fragile');
  }

  const baseAllowance = getBaseDailyAllowance(remainingBudget, remainingDays);
  const safetyRange = getSafetyRange(baseAllowance);
  const recentAverageDays = Math.max(1, Math.min(7, remainingDays));
  const recentAverage = getRecentAverage(expenses, recentAverageDays);
  const riskLabel = getRiskLabel(recentAverage, safetyRange);

  return getQualitativeBudgetState(riskLabel);
}

// Adds up every valid expense amount to show how much has been spent so far.
export function getSpentSoFar(expenses: Expense[]): number {
  if (!Array.isArray(expenses)) {
    return 0;
  }

  return expenses.reduce((total, expense) => total + toSafeNumber(expense?.amount), 0);
}

// Subtracts the spent money from the full budget to show what is still left.
export function getRemainingBudget(budget: number, spent: number): number {
  const remainingBudget = toSafeNumber(budget) - toSafeNumber(spent);

  return Math.max(0, remainingBudget);
}

// Counts how many calendar days remain from today through the end date.
export function getRemainingDays(today: Date | string, monthEnd: Date | string): number {
  const start = toStartOfDay(today).getTime();
  const end = toStartOfDay(monthEnd).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.floor((end - start) / millisecondsPerDay) + 1);
}

// Divides the money that is left by the days that are left to get a daily amount.
export function getBaseDailyAllowance(remainingBudget: number, remainingDays: number): number {
  const safeRemainingBudget = toSafeNumber(remainingBudget);
  const safeRemainingDays = toSafeNumber(remainingDays);

  if (safeRemainingBudget <= 0 || safeRemainingDays <= 0) {
    return 0;
  }

  return safeRemainingBudget / safeRemainingDays;
}

// Creates a simple low-to-high spending range around the daily allowance.
export function getSafetyRange(baseAllowance: number): SafetyRange {
  const safeBaseAllowance = Math.max(0, toSafeNumber(baseAllowance));

  return {
    low: safeBaseAllowance * 0.8,
    high: safeBaseAllowance,
  };
}

// Finds the average daily spending from expenses within the most recent number of days.
export function getRecentAverage(expenses: Expense[], lastNDays: number): number {
  const safeLastNDays = toSafeNumber(lastNDays);

  if (!Array.isArray(expenses) || safeLastNDays <= 0 || expenses.length === 0) {
    return 0;
  }

  const safeExpenses = expenses.filter(isExpenseLike);

  if (safeExpenses.length === 0) {
    return 0;
  }

  const expenseTimes = safeExpenses
    .map((expense) => toStartOfDay(expense.date).getTime())
    .filter(Number.isFinite);

  if (expenseTimes.length === 0) {
    return 0;
  }

  const latestExpenseTime = Math.max(...expenseTimes);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const firstIncludedDay = latestExpenseTime - (safeLastNDays - 1) * millisecondsPerDay;
  const recentTotal = safeExpenses.reduce((total, expense) => {
    const expenseTime = toStartOfDay(expense.date).getTime();

    if (
      !Number.isFinite(expenseTime) ||
      expenseTime < firstIncludedDay ||
      expenseTime > latestExpenseTime
    ) {
      return total;
    }

    return total + toSafeNumber(expense.amount);
  }, 0);

  return recentTotal / safeLastNDays;
}

// Labels spending as safe, watchful, or fragile by comparing it to the safety range.
export function getRiskLabel(recentAverage: number, safetyRange: SafetyRange): RiskLabel {
  const safeRecentAverage = toSafeNumber(recentAverage);
  const low = toSafeNumber(safetyRange?.low);
  const high = toSafeNumber(safetyRange?.high);

  if (safeRecentAverage <= low) {
    return 'safe';
  }

  if (safeRecentAverage <= high) {
    return 'watchful';
  }

  return 'fragile';
}


function getQualitativeBudgetState(riskLabel: RiskLabel): BudgetState {
  if (riskLabel === 'safe') {
    return {
      riskLabel,
      zoneLabel: "You're pacing yourself well.",
      paceLabel: 'You have some flexibility.',
    };
  }

  if (riskLabel === 'watchful') {
    return {
      riskLabel,
      zoneLabel: 'You are keeping a steady pace.',
      paceLabel: 'Things are getting tighter.',
    };
  }

  return {
    riskLabel,
    zoneLabel: 'Take it easy on spending.',
    paceLabel: 'Flexibility is limited.',
  };
}

function isExpenseLike(value: unknown): value is Expense {
  return typeof value === 'object' && value !== null;
}

function toSafeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toStartOfDay(date: unknown): Date {
  const parsedDate = date instanceof Date || typeof date === 'string' ? new Date(date) : new Date(Number.NaN);

  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
}
