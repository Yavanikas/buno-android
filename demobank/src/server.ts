import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// DEMO BANK (SIMULATED)
// A standalone fake banking service used only for demos and automated
// verification. Every byte of data is fabricated, deterministic and clearly
// flagged with X-Demo-Bank / X-Data-Simulated headers.
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Clearly mark every response as simulated.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Demo-Bank', 'true');
  res.setHeader('X-Data-Simulated', 'true');
  next();
});

// ─── Deterministic RNG ───────────────────────────────────────────────────────
function seededRandom(seed: string): () => number {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  let index = 0;
  return function () {
    const value = parseInt(hash.slice(index, index + 8), 16) / 0xffffffff;
    index = (index + 8) % hash.length;
    return value;
  };
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function amountIn(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

// ─── Account store (in-memory, idempotent per demo user) ─────────────────────
const accounts = new Map<string, any>();

function createDemoAccount(body: any = {}): any {
  const userId = body.userId || 'demo-user';
  const existing = accounts.get(userId);
  if (existing) return existing;

  const account = {
    id: body.userId ? `acc_${md5(userId).slice(0, 12)}` : 'acc_demo_001',
    userId,
    name: body.name || 'Demo Bank Checking',
    balance: 45230.5,
    currency: body.currency || 'INR',
    type: body.type || 'checking',
    simulated: true,
    createdAt: new Date().toISOString(),
  };
  accounts.set(userId, account);
  return account;
}

// ─── Realistic transaction generator (≈60 days) ──────────────────────────────
interface MockTx {
  id: string;
  accountId: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  description: string;
  date: string;
}

function generateMockTransactions(accountId: string): MockTx[] {
  const transactions: MockTx[] = [];
  const rand = seededRandom(`demobank-transactions:${accountId}`);
  const now = new Date();

  const dayStart = (daysAgo: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const randTime = (): { h: number; m: number } => {
    const h = Math.floor(rand() * 14) + 8; // 8 AM – 10 PM
    const m = Math.floor(rand() * 60);
    return { h, m };
  };

  const push = (
    merchant: string,
    category: string,
    amount: number,
    date: Date,
    type?: 'credit' | 'debit'
  ): void => {
    const t = randTime();
    date.setHours(t.h, t.m, 0, 0);
    const txType = type || (category === 'Income' ? 'credit' : 'debit');
    transactions.push({
      id: md5(`${accountId}|${date.toISOString()}|${merchant}|${category}`),
      accountId,
      amount: round2(amount),
      type: txType,
      category,
      description: merchant,
      date: date.toISOString(),
    });
  };

  for (let d = 60; d >= 0; d--) {
    const day = dayStart(d);
    const dow = day.getDay(); // 0 = Sunday, 6 = Saturday
    const weekend = dow === 0 || dow === 6;
    const dom = day.getDate();

    // ── Income ──
    if (dom === 1) push('Salary', 'Income', 50000, day, 'credit');

    // ── Recurring subscriptions (fixed day each month) ──
    switch (dom) {
      case 3: push('GymFit Membership', 'Personal Care', 999, day); break;
      case 10: push('Airtel Prepaid', 'Utilities', 299, day); break;
      case 12: push('Netflix', 'Entertainment', 199, day); break;
      case 15: push('Udemy', 'Education', 799, day); break;
      case 18: push('Spotify', 'Entertainment', 119, day); break;
      case 22: push('ACT Fibernet', 'Utilities', 999, day); break;
      case 25: push('Health Insurance', 'Healthcare', 1500, day); break;
    }

    // ── Monthly utility bills ──
    if (dom === 5) push('Electricity Board', 'Utilities', amountIn(rand, 800, 2500), day);
    if (dom === 8) push('Water Board', 'Utilities', amountIn(rand, 400, 900), day);

    // ── Weekly grocery run (Mon & Thu) ──
    if (dow === 1 || dow === 4) push('FreshMart', 'Groceries', amountIn(rand, 300, 2000), day);

    // ── Biweekly personal care ──
    if (d % 10 === 4) push('Luxor Salon', 'Personal Care', amountIn(rand, 500, 1500), day);

    // ── Weekday vs weekend lifestyle patterns ──
    if (!weekend) {
      // Commute & daily habits on weekdays
      if (rand() < 0.85) push('Starbucks', 'Food', amountIn(rand, 150, 320), day);
      if (rand() < 0.55) push('Uber', 'Transport', amountIn(rand, 60, 250), day);
      if (rand() < 0.45) push('Metro Card', 'Transport', amountIn(rand, 30, 80), day);
      if (rand() < 0.6) push('Swiggy', 'Food', amountIn(rand, 150, 450), day);
    } else {
      // Weekend: dining out, grocery stock-up, shopping, entertainment
      if (rand() < 0.8) push('Café Brunch', 'Food', amountIn(rand, 300, 900), day);
      if (rand() < 0.7) push('BigBasket', 'Groceries', amountIn(rand, 600, 2500), day);
      if (rand() < 0.6) push('PVR Cinemas', 'Entertainment', amountIn(rand, 250, 700), day);
      if (rand() < 0.5) push('Zomato', 'Food', amountIn(rand, 300, 900), day);
      if (rand() < 0.5) push('Amazon', 'Shopping', amountIn(rand, 400, 3000), day);
      if (rand() < 0.35) push('Flipkart', 'Shopping', amountIn(rand, 300, 2000), day);
      if (rand() < 0.3) push('Myntra', 'Shopping', amountIn(rand, 500, 2500), day);
    }

    // ── Occasional spends (across all days) ──
    if (rand() < 0.15) push('Apollo Pharmacy', 'Healthcare', amountIn(rand, 100, 1500), day);
    if (rand() < 0.08) push('Coursera', 'Education', amountIn(rand, 500, 2000), day);
    if (rand() < 0.12) push('HP Fuel', 'Transport', amountIn(rand, 800, 1800), day);
  }

  // Sort newest first
  return transactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Demo Bank (Simulated)',
    simulated: true,
    disclaimer:
      'This is a simulated demo banking service for the Buno app. All accounts and transactions are fabricated, deterministic data.',
  });
});

// POST /api/accounts — create (or reuse) a demo account
app.post('/api/accounts', (req: Request, res: Response) => {
  const account = createDemoAccount(req.body || {});
  res.status(201).json({ account });
});

// GET /api/accounts — list demo accounts
app.get('/api/accounts', (req: Request, res: Response) => {
  res.json({ accounts: Array.from(accounts.values()) });
});

// GET /api/accounts/:accountId/transactions
app.get('/api/accounts/:accountId/transactions', (req: Request, res: Response) => {
  const accountId = String(req.params.accountId);
  const transactions = generateMockTransactions(accountId);
  res.json({ accountId, simulated: true, transactions });
});

// POST /api/sync/acknowledge
app.post('/api/sync/acknowledge', (req: Request, res: Response) => {
  const { syncId } = req.body || {};
  res.json({ status: 'acknowledged', syncId: syncId || null, simulated: true });
});

// ─── Boot ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Demo Bank] simulated service running on http://localhost:${PORT}`);
    console.log(`[Demo Bank] health: http://localhost:${PORT}/api/health`);
  });
}

export { app, generateMockTransactions, createDemoAccount };
