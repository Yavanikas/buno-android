import type { Expense } from '../lib/calc';

export type MockExpense = Expense & {
  category:
    | 'food'
    | 'transport'
    | 'groceries'
    | 'subscriptions'
    | 'academics'
    | 'social'
    | 'personal care';
  note: string;
};

export const mockExpenses: MockExpense[] = [
  {
    amount: 90,
    date: '2026-07-01',
    category: 'food',
    note: 'Canteen breakfast',
  },
  {
    amount: 45,
    date: '2026-07-03',
    category: 'transport',
    note: 'Metro recharge',
  },
  {
    amount: 320,
    date: '2026-07-05',
    category: 'groceries',
    note: 'Hostel snacks',
  },
  {
    amount: 149,
    date: '2026-07-07',
    category: 'subscriptions',
    note: 'Music plan',
  },
  {
    amount: 520,
    date: '2026-07-09',
    category: 'academics',
    note: 'Lab manual',
  },
  {
    amount: 180,
    date: '2026-07-10',
    category: 'food',
    note: 'Lunch with friends',
  },
  {
    amount: 75,
    date: '2026-07-12',
    category: 'transport',
    note: 'Auto to campus',
  },
  {
    amount: 640,
    date: '2026-07-14',
    category: 'social',
    note: 'Movie outing',
  },
  {
    amount: 260,
    date: '2026-07-16',
    category: 'personal care',
    note: 'Toiletries refill',
  },
  {
    amount: 199,
    date: '2026-07-18',
    category: 'subscriptions',
    note: 'Mobile data pack',
  },
  {
    amount: 110,
    date: '2026-07-19',
    category: 'food',
    note: 'Evening dosa',
  },
  {
    amount: 390,
    date: '2026-07-23',
    category: 'academics',
    note: 'Printouts',
  },
  {
    amount: 220,
    date: '2026-07-25',
    category: 'personal care',
    note: 'Laundry pickup',
  },
  {
    amount: 850,
    date: '2026-07-28',
    category: 'groceries',
    note: 'Monthly basics',
  },
];
