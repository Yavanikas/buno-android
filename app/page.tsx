'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import PatternInsight from '../components/PatternInsight';
import ProbabilityWindow from '../components/ProbabilityWindow';
import { mockExpenses, type MockExpense } from '../data/mockExpenses';
import { getBudgetState, getRemainingDays } from '../lib/calc';
import { getMonthlyPatternSummary, type MonthlyPatternSummary } from '../lib/patterns';

const initialMonthlyBudget = 8000;
const expenseCategories: MockExpense['category'][] = [
  'food',
  'transport',
  'groceries',
  'subscriptions',
  'academics',
  'social',
  'personal care',
];

type SessionExpense = MockExpense & { id: string };

function createExpenseId(
  expense: { date?: string | Date; category?: string; amount?: number; note?: string },
  index: number,
): string {
  const safeDate =
    typeof expense.date === 'string'
      ? expense.date
      : expense.date instanceof Date && !Number.isNaN(expense.date.getTime())
        ? expense.date.toISOString()
        : 'unknown-date';

  const safeCategory =
    typeof expense.category === 'string' && expense.category.trim()
      ? expense.category.trim().toLowerCase().replace(/\s+/g, '-')
      : 'uncategorized';

  const safeAmount =
    typeof expense.amount === 'number' && Number.isFinite(expense.amount)
      ? String(expense.amount)
      : '0';

  const safeNote =
    typeof expense.note === 'string' && expense.note.trim()
      ? expense.note.trim().toLowerCase().replace(/\s+/g, '-')
      : 'expense';

  return `${safeDate}-${safeCategory}-${safeAmount}-${safeNote}-${index}`;
}

function createNewExpenseId(
  expense: { date?: string | Date; category?: string; amount?: number; note?: string },
  index: number,
): string {
  return createExpenseId(expense, index);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function Home() {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [monthlyBudget, setMonthlyBudget] = useState(initialMonthlyBudget);
  const [budgetInput, setBudgetInput] = useState(String(initialMonthlyBudget));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState('');
  const [expenses, setExpenses] = useState<SessionExpense[]>(() =>
    mockExpenses.map((expense, index) => ({
      ...expense,
      id: createExpenseId(expense, index),
    })),
  );
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<MockExpense['category']>('food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getTodayInputValue);
  const [formMessage, setFormMessage] = useState('');

  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysRemaining = getRemainingDays(today, monthEnd);
  const totalExpensesLogged = Array.isArray(expenses) ? expenses.length : 0;
  const budgetState = useMemo(
    () =>
      getBudgetState({
        totalBudget: monthlyBudget,
        expenses,
        remainingDays: daysRemaining,
      }),
    [daysRemaining, expenses, monthlyBudget],
  );
  const recentExpenses = useMemo(
    () =>
      [...expenses].sort(
        (firstExpense, secondExpense) => getExpenseTime(secondExpense) - getExpenseTime(firstExpense),
      ),
    [expenses],
  );
  const monthlyPatternSummary = useMemo(
    () => getMonthlyPatternSummary(expenses, today),
    [expenses, today],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount);
    const trimmedNote = note.trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !date || !trimmedNote) {
      setFormMessage('Add an amount, date, and short note before saving.');
      return;
    }

    setExpenses((currentExpenses) => [
      ...currentExpenses,
      {
        id: createNewExpenseId({ amount: parsedAmount, category, date, note: trimmedNote }, currentExpenses.length),
        amount: parsedAmount,
        category,
        date,
        note: trimmedNote,
      },
    ]);
    setAmount('');
    setCategory('food');
    setNote('');
    setDate(getTodayInputValue());
    setFormMessage('Expense added for this session.');
  }

  function handleBudgetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedBudget = Number(budgetInput);

    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setBudgetMessage('Enter a monthly budget greater than zero.');
      return;
    }

    setMonthlyBudget(parsedBudget);
    setBudgetInput(String(Math.round(parsedBudget)));
    setIsEditingBudget(false);
    setBudgetMessage('Monthly budget updated for this session.');
  }

  function handleDeleteExpense(expenseId: unknown) {
    if (typeof expenseId !== 'string' || !expenseId.trim()) {
      setFormMessage('Could not delete that expense. Please try again.');
      return;
    }

    setExpenses((currentExpenses) => currentExpenses.filter((expense) => expense.id !== expenseId));
    setFormMessage('Expense deleted for this session.');
  }

  function handleCurrencyToggle() {
    if (currency === 'INR') {
      setCurrency('USD');
      const newBudget = Math.max(1, Math.round(monthlyBudget / 80));
      setMonthlyBudget(newBudget);
      setBudgetInput(String(newBudget));
      setExpenses((currentExpenses) =>
        currentExpenses.map((expense) => ({ ...expense, amount: Math.max(1, Math.round(expense.amount / 80)) }))
      );
    } else {
      setCurrency('INR');
      const newBudget = Math.round(monthlyBudget * 80);
      setMonthlyBudget(newBudget);
      setBudgetInput(String(newBudget));
      setExpenses((currentExpenses) =>
        currentExpenses.map((expense) => ({ ...expense, amount: Math.round(expense.amount * 80) }))
      );
    }
  }

  return (
    <main className="min-h-screen text-[#3a2118]">
      <div className="mx-auto flex w-full max-w-7xl flex-col shadow-[0_30px_80px_rgba(76,45,33,0.06)]">
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2 lg:gap-8 bg-[#faf9f6] px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
              <HeroHeader
                riskLabel={budgetState.riskLabel}
                zoneLabel={budgetState.zoneLabel}
                paceLabel={budgetState.paceLabel}
              />

                <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
                  <div className="flex min-w-0 flex-col gap-6">
                    <ProbabilityWindow
                      riskLabel={budgetState.riskLabel}
                      zoneLabel={budgetState.zoneLabel}
                      paceLabel={budgetState.paceLabel}
                    />

                    <section className="border-b-2 border-dotted border-[#c8bba9] pb-8 pt-4">
                      <div className="mb-5 flex flex-col gap-1">
                        <h2 className="font-serif text-2xl font-bold tracking-tight text-[#3a2118]">Your core budget</h2>
                        <p className="text-sm text-[#7d6253]">Your foundation for this month's spending.</p>
                      </div>

                      <div className="grid gap-6 sm:grid-cols-3">
                        {isEditingBudget ? (
                          <form onSubmit={handleBudgetSubmit} className="min-w-0 flex flex-col justify-between">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a48673]">Monthly budget</p>
                              <input
                                type="number"
                                value={budgetInput}
                                onChange={(e) => setBudgetInput(e.target.value)}
                                className="mt-2 w-full border-b border-[#ead9c8] bg-transparent px-2 py-1 text-sm text-[#3a2118] outline-none focus:border-[#8a6557]"
                                min="1"
                                required
                              />
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button type="submit" className="rounded bg-[#4b2c22] px-4 py-1.5 text-xs font-bold text-[#fff7ed] shadow-sm transition hover:bg-[#5b382c]">Save</button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingBudget(false);
                                  setBudgetInput(String(monthlyBudget));
                                  setBudgetMessage('');
                                }}
                                className="rounded bg-[#ead9c8] px-4 py-1.5 text-xs font-semibold text-[#6e4d3f] transition hover:bg-[#dfcdbb]"
                              >
                                Cancel
                              </button>
                            </div>
                            {budgetMessage && <p className="mt-1 text-[10px] text-[#7d6253] font-medium">{budgetMessage}</p>}
                          </form>
                        ) : (
                          <SummaryTile
                            label="Monthly budget"
                            value={formatCurrency(monthlyBudget, currency)}
                            action={
                              <button
                                onClick={() => {
                                  setIsEditingBudget(true);
                                  setBudgetMessage('');
                                }}
                                className="text-xs font-semibold text-[#8a6557] hover:underline"
                              >
                                Change Budget
                              </button>
                            }
                          />
                        )}
                        <SummaryTile label="Days remaining" value={String(daysRemaining)} />
                        <SummaryTile label="Expenses logged" value={String(totalExpensesLogged)} />
                      </div>
                    </section>
                  </div>

                  <section className="flex flex-col justify-between border-b-2 border-dotted border-[#c8bba9] pb-8 pt-4 lg:min-h-[26rem]">
                    <div className="flex flex-col gap-1">
                      <h2 className="font-serif text-2xl font-bold tracking-tight text-[#3a2118]">Your spending rhythm</h2>
                      <p className="text-sm text-[#7d6253]">{monthlyPatternSummary.currentMonthActivitySummary}</p>
                    </div>

                    <div className="mt-6 grid gap-6">
                      <SummaryTile label="This month" value={`${monthlyPatternSummary.totalExpensesThisMonth} logs`} />
                      <SummaryTile label="Top category" value={toTitleCase(monthlyPatternSummary.mostFrequentCategory)} />
                      <SummaryTile
                        label="Rhythm"
                        value={monthlyPatternSummary.hasClusteredSpending ? 'Clustered' : 'Steady'}
                      />
                    </div>
                  </section>
                </div>

                <section className="border-b-2 border-dotted border-[#c8bba9] pb-8 pt-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-serif text-xl font-bold tracking-tight text-[#3a2118]">Log a quick expense</h2>
                    <p className="text-sm text-[#7d6253]">Keep track of what you just spent.</p>
                  </div>

                  <form className="mt-5 grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-[#5d4035]">
                      Amount
                      <input className="min-w-0 border-b border-[#ead9c8] bg-transparent px-2 py-2 text-[#3a2118] outline-none transition placeholder:text-[#b79b89] focus:border-[#8a6557]" min="1" onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" required type="number" value={amount} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-[#5d4035]">
                      Category
                      <select className="min-w-0 border-b border-[#ead9c8] bg-transparent px-2 py-2 text-[#3a2118] outline-none transition focus:border-[#8a6557]" onChange={(event) => setCategory(event.target.value as MockExpense['category'])} value={category}>
                        {expenseCategories.map((expenseCategory) => <option key={expenseCategory} value={expenseCategory}>{expenseCategory}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-[#5d4035] md:col-span-2">
                      Note
                      <input className="min-w-0 border-b border-[#ead9c8] bg-transparent px-2 py-2 text-[#3a2118] outline-none transition placeholder:text-[#b79b89] focus:border-[#8a6557]" onChange={(event) => setNote(event.target.value)} placeholder="e.g. Canteen lunch" required type="text" value={note} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-[#5d4035]">
                      Date
                      <input className="min-w-0 border-b border-[#ead9c8] bg-transparent px-2 py-2 text-[#3a2118] outline-none transition focus:border-[#8a6557]" onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
                    </label>
                    <div className="flex flex-col justify-end gap-2">
                      <button className="rounded bg-[#4b2c22] px-5 py-2 text-sm font-bold text-[#fff7ed] shadow-sm transition hover:bg-[#5b382c]" type="submit">Log expense</button>
                      {formMessage ? <p className="text-sm text-[#7d6253]">{formMessage}</p> : null}
                    </div>
                  </form>
                </section>
              </div>

              <aside className="flex min-w-0 flex-col gap-6 lg:col-span-1 lg:min-h-[calc(100vh-4rem)] bg-[#eee8e0] px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
                <PatternInsight riskLabel={budgetState.riskLabel} recentExpenses={expenses} daysRemaining={daysRemaining} />

                <section className="min-w-0 pt-4">
                  <div className="flex flex-col gap-1 mb-6">
                    <h2 className="font-serif text-2xl font-bold tracking-tight text-[#3a2118]">Recent Activity</h2>
                    <p className="text-sm text-[#7d6253]">Your latest logged expenses for this demo session.</p>
                  </div>

                  {recentExpenses.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {recentExpenses.slice(0, 6).map((expense) => (
                        <div className="flex min-w-0 flex-col gap-1 border-b border-dashed border-[#dcd1c4] pb-4 pt-1 last:border-0 hover:bg-[#e7dfd4] transition px-2 -mx-2 rounded-lg" key={expense.id}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 flex gap-3">
                              <div className="mt-1 text-[#8B4513] opacity-80">{getCategoryIcon(expense.category)}</div>
                              <div>
                                <p className="break-words text-base font-semibold text-[#3a2118]">{expense.note}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#a48673]">{formatExpenseDate(expense.date)}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B4513]">● {expense.category}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <p className="font-serif text-lg font-bold text-[#3a2118]">{formatCurrency(expense.amount, currency)}</p>
                              <button onClick={() => handleDeleteExpense(expense.id)} className="text-[10px] font-bold uppercase tracking-wider text-[#b09380] opacity-0 transition-opacity hover:text-[#4b2c22] hover:underline group-hover:opacity-100 mt-1" title="Delete expense" style={{ opacity: 1 /* fallback if group not used, let's keep it visible but muted */ }}>Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 border-t border-[#ead9c8] pt-4 text-sm text-[#7d6253]">No expenses yet. Add your first expense when you are ready.</p>
                  )}
                </section>
              </aside>
            </div>

            <section className="border-t-2 border-dotted border-[#c8bba9] pb-8 pt-8 flex flex-col gap-6 bg-[#faf9f6] px-5 sm:px-8 lg:px-12">
              <div>
                <h2 className="font-serif text-2xl font-bold tracking-tight text-[#3a2118]">Settings</h2>
                <p className="text-sm text-[#7d6253]">Manage your demo session configurations.</p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7968]">Monthly Budget</h3>
                  <p className="text-sm text-[#7d6253]">
                    Update your total spending budget for this monthly cycle. Recalculates risk indicators and daily allowance automatically.
                  </p>
                  
                  <form onSubmit={handleBudgetSubmit} className="flex flex-col gap-3 mt-2">
                    <label className="flex flex-col gap-1 text-sm font-semibold text-[#5d4035]">
                      Budget Value ({currency === 'USD' ? '$' : '₹'})
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="border-b border-[#ead9c8] bg-transparent px-2 py-2 text-sm text-[#3a2118] outline-none transition focus:border-[#8a6557]"
                        min="1"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-fit rounded bg-[#4b2c22] px-4 py-2 text-sm font-bold text-[#fff7ed] shadow-sm transition hover:bg-[#5b382c]"
                    >
                      Save Budget
                    </button>
                    {budgetMessage && <p className="text-xs text-[#7d6253] font-medium">{budgetMessage}</p>}
                  </form>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7968]">Currency Settings</h3>
                  <p className="text-sm text-[#7d6253]">
                    Switch between Indian Rupee (₹) and US Dollar ($). The amounts will be automatically converted (Mock Rate 1 USD = 80 INR).
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={handleCurrencyToggle}
                      className="rounded bg-[#ead9c8] px-4 py-2 text-sm font-semibold text-[#6e4d3f] hover:bg-[#dfcdbb] transition"
                    >
                      Switch to {currency === 'INR' ? 'USD ($)' : 'INR (₹)'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7968]">Session Data</h3>
                  <p className="text-sm text-[#7d6253]">
                    Reset the mock expenses back to the default dataset or clear everything.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setExpenses(mockExpenses.map((expense, index) => ({
                          ...expense,
                          id: createExpenseId(expense, index),
                        })));
                        setFormMessage('Expenses reset to mock defaults.');
                      }}
                      className="rounded bg-[#ead9c8] px-4 py-2 text-sm font-semibold text-[#6e4d3f] hover:bg-[#dfcdbb] transition"
                    >
                      Reset to defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpenses([]);
                        setFormMessage('All expenses cleared.');
                      }}
                      className="rounded border border-red-200 bg-transparent px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition"
                    >
                      Clear all expenses
                    </button>
                  </div>
                </div>
              </div>
            </section>
        </div>
      </div>
    </main>
  );
}


function HeroHeader({ riskLabel, zoneLabel, paceLabel }: { riskLabel: string; zoneLabel?: string; paceLabel?: string }) {
  const [greetingData, setGreetingData] = useState({
    paceSummary: "You're spending slower than usual this week.",
    monthOutlook: "At this pace, the rest of the month looks comfortable.",
    todaySuggestion: "Skip one unnecessary food delivery and you'll keep plenty of flexibility.",
  });

  const greetingTime = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadHeaderAdvice() {
      try {
        const response = await fetch('/api/advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riskLabel, zoneLabel, paceLabel }),
        });
        if (response.ok) {
          const data = await response.json();
          if (isMounted && data.paceSummary) {
            setGreetingData({
              paceSummary: data.paceSummary,
              monthOutlook: data.monthOutlook || "At this pace, the rest of the month looks comfortable.",
              todaySuggestion: data.todaySuggestion || "Keep an eye on your pace today.",
            });
          }
        }
      } catch {
        // preserve defaults
      }
    }
    loadHeaderAdvice();
    return () => { isMounted = false; };
  }, [riskLabel, zoneLabel, paceLabel]);

  return (
    <header className="flex flex-col gap-4 border-b-2 border-dotted border-[#c8bba9] pb-8 pt-4">
      <div className="flex items-center gap-4">
        <BunnyLogo />
        <h1 className="font-serif text-4xl font-black tracking-wide text-[#8B4513] sm:text-5xl" style={{ letterSpacing: '0.04em' }}>
          BUNO
        </h1>
      </div>
      <div className="flex flex-col gap-2 max-w-2xl text-sm leading-relaxed text-[#5d4035] sm:text-base mt-2">
        <h2 className="font-serif text-2xl font-bold tracking-wide text-[#3a2118] sm:text-3xl mb-1">
          {greetingTime}, User.
        </h2>
        <p className="font-medium">{greetingData.paceSummary}</p>
        <p className="text-[#735747]">{greetingData.monthOutlook}</p>
        <div className="mt-3 pt-3 border-t border-dashed border-[#dcd1c4]">
          <span className="font-bold uppercase tracking-wider block text-[10px] text-[#a48673] mb-1">Today&apos;s suggestion</span>
          <p className="italic font-serif text-[#4b2c22] text-base sm:text-lg">&ldquo;{greetingData.todaySuggestion}&rdquo;</p>
        </div>
      </div>
    </header>
  );
}

function BunnyLogo() {
  return (
    <div className="flex flex-col items-center justify-center p-1 lg:mb-2">
      <svg width="56" height="80" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="BUNO Bunny Logo">
        {/* Left Ear */}
        <ellipse cx="36" cy="28" rx="8" ry="26" fill="#8B4513" transform="rotate(-10 36 28)" />
        <ellipse cx="36" cy="28" rx="4.5" ry="20" fill="#C08B6B" transform="rotate(-10 36 28)" />
        {/* Right Ear */}
        <ellipse cx="64" cy="28" rx="8" ry="26" fill="#8B4513" transform="rotate(10 64 28)" />
        <ellipse cx="64" cy="28" rx="4.5" ry="20" fill="#C08B6B" transform="rotate(10 64 28)" />

        {/* Head */}
        <circle cx="50" cy="62" r="22" fill="#D2B48C" />

        {/* Eyes */}
        <circle cx="42" cy="58" r="2.5" fill="#3E2215" />
        <circle cx="58" cy="58" r="2.5" fill="#3E2215" />

        {/* Nose */}
        <ellipse cx="50" cy="65" rx="2" ry="1.5" fill="#3E2215" />

        {/* Mouth */}
        <path d="M 47 68 Q 50 72 53 68" stroke="#3E2215" strokeWidth="1.2" fill="none" strokeLinecap="round" />

        {/* Body */}
        <ellipse cx="50" cy="108" rx="24" ry="28" fill="#8B4513" />

        {/* Belly */}
        <ellipse cx="50" cy="110" rx="14" ry="18" fill="#D2B48C" />

        {/* Coins on stomach */}
        <ellipse cx="50" cy="104" rx="10" ry="3.5" fill="#C8913B" stroke="#A67424" strokeWidth="1" />
        <ellipse cx="50" cy="109" rx="10" ry="3.5" fill="#D4A04A" stroke="#B8892E" strokeWidth="1" />
        <ellipse cx="50" cy="114" rx="10" ry="3.5" fill="#E0B05A" stroke="#C89838" strokeWidth="1" />

        {/* Feet */}
        <ellipse cx="34" cy="132" rx="10" ry="5" fill="#8B4513" />
        <ellipse cx="66" cy="132" rx="10" ry="5" fill="#8B4513" />
      </svg>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex flex-col justify-between border-l-2 border-dotted border-[#c8bba9] pl-4 py-1">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a48673]">{label}</p>
        <p className="font-serif mt-1 break-words text-2xl italic text-[#3a2118]">{value}</p>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function PatternSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col border-l border-[#ead9c8] pl-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7968]">{label}</p>
      <p className="mt-1 text-lg font-medium text-[#3a2118]">{value}</p>
    </div>
  );
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getExpenseTime(expense: MockExpense): number {
  const time = new Date(expense.date).getTime();

  return Number.isFinite(time) ? time : 0;
}

function formatExpenseDate(date: Date | string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Date not set';
  }

  return parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function getExpenseSizeLabel(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Spend logged';
  }

  if (amount <= 150) {
    return 'Small spend';
  }

  if (amount <= 500) {
    return 'Medium spend';
  }

  return 'Larger spend';
}

function getCategoryIcon(category: string) {
  const c = category.toLowerCase();
  switch (c) {
    case 'food':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 8-4-4-6 6 4 4" />
          <path d="m13 13 6 6-2 2-6-6" />
          <path d="M5 9v11" />
          <path d="M9 5v15" />
          <path d="M4.5 12h5" />
        </svg>
      );
    case 'groceries':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case 'transport':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case 'personal care':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2v7.31" />
          <path d="M14 9.3V1.99" />
          <path d="M8.5 2h7" />
          <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
          <path d="M5.52 16h12.96" />
        </svg>
      );
    case 'social':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10.42 12.61a2.1 2.1 0 1 1 2.97 2.97L7.95 21 4 22l.99-3.95 5.43-5.44Z" />
        </svg>
      );
    case 'academics':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      );
    case 'subscriptions':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

function getSpendingHealthScore(summary: MonthlyPatternSummary) {
  let score = 100;
  if (summary.hasRepeatedSmallPurchases) score -= 20;
  if (summary.hasClusteredSpending) score -= 15;
  if (summary.totalExpensesThisMonth > 15) {
    score -= Math.min(15, (summary.totalExpensesThisMonth - 15) * 2);
  }
  score = Math.max(10, score);
  
  let label = 'Excellent';
  if (score < 60) label = 'Needs Attention';
  else if (score < 80) label = 'Good';
  
  return { score, label };
}

function getConsistencyPct(summary: MonthlyPatternSummary): number {
  const total = summary.totalExpensesThisMonth;
  if (total === 0) return 100;
  const weekdayRatio = summary.weekdayExpenseCount / total;
  const dev = Math.abs(weekdayRatio - 0.71);
  const score = Math.round((1 - dev) * 100);
  return Math.max(30, Math.min(100, score));
}

function getActiveDays(expenses: { date: string | Date }[]): Set<number> {
  const activeDays = new Set<number>();
  expenses.forEach((expense) => {
    const d = new Date(expense.date);
    if (!Number.isNaN(d.getTime())) {
      activeDays.add(d.getDate());
    }
  });
  return activeDays;
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col justify-between border-l-2 border-dotted border-[#c8bba9] pl-4 ${accent ? 'border-l-[#8B4513]' : ''}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a48673]">{label}</span>
      <span className="font-serif mt-1 text-2xl italic text-[#3a2118]">{value}</span>
    </div>
  );
}

function formatCurrency(amount: number, currency: 'INR' | 'USD') {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
