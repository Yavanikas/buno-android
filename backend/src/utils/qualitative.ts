export interface QualitativeBudgetState {
  riskLabel: 'SAFE' | 'WATCHFUL' | 'FRAGILE';
  zoneLabel: string;
  paceLabel: string;
  daysRemaining: number;
  expensesLogged: number;
  currency: string;
}

export function computeQualitativeState(
  monthlyLimit: number,
  currency: string,
  expenses: Array<{ amount: number; date: Date | string }>,
  month: number,
  year: number
): QualitativeBudgetState {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  const currentMonth = month || (now.getMonth() + 1);

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const expensesLogged = expenses.length;

  const monthProgress = currentDay / daysInMonth;
  const budgetSpentRatio = monthlyLimit > 0 ? totalSpent / monthlyLimit : 1;

  let riskLabel: 'SAFE' | 'WATCHFUL' | 'FRAGILE';
  let zoneLabel: string;
  let paceLabel: string;

  if (monthProgress === 0 || budgetSpentRatio === 0) {
    riskLabel = 'SAFE';
    zoneLabel = 'Fresh cycle starting.';
    paceLabel = 'Pace is calm and unhurried.';
  } else {
    const paceRatio = budgetSpentRatio / monthProgress;

    if (paceRatio <= 0.85) {
      riskLabel = 'SAFE';
      zoneLabel = 'You are well within your comfort zone.';
      paceLabel = 'Spending is calm and measured.';
    } else if (paceRatio <= 1.15) {
      riskLabel = 'WATCHFUL';
      zoneLabel = 'You are keeping a steady pace.';
      paceLabel = 'Pace is aligned with the monthly rhythm.';
    } else {
      riskLabel = 'FRAGILE';
      zoneLabel = 'Spending is running higher than typical.';
      paceLabel = 'Things are running tighter this week.';
    }
  }

  return {
    riskLabel,
    zoneLabel,
    paceLabel,
    daysRemaining,
    expensesLogged,
    currency,
  };
}
