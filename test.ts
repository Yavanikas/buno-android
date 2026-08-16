import {
  getSpentSoFar,
  getRemainingBudget,
  getRemainingDays,
  getBaseDailyAllowance,
  getSafetyRange,
  getRecentAverage,
  getRiskLabel,
} from "./lib/calc";

const expenses = [
  { amount: 10, date: "2026-07-14" },
  { amount: 20, date: "2026-07-15" },
  { amount: 30, date: "2026-07-16" },
];

console.log("spent:", getSpentSoFar(expenses));
console.log("remaining budget:", getRemainingBudget(100, 60));
console.log("remaining days:", getRemainingDays("2026-07-16", "2026-07-31"));
console.log("base daily allowance:", getBaseDailyAllowance(160, 16));
console.log("safety range:", getSafetyRange(10));
console.log("recent average:", getRecentAverage(expenses, 3));
console.log("risk:", getRiskLabel(20, { low: 8, high: 10 }));