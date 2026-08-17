import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import budgetRouter from './routes/budget';
import transactionsRouter from './routes/transactions';

const app = express();

app.use(cors());
app.use(express.json());

// ─── Root Info Route ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    name: 'Buno Backend API',
    version: '1.0.0',
    description: 'Qualitative Calm Budgeting API',
    endpoints: {
      health: 'GET /health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
      },
      budgets: {
        list: 'GET /api/budgets',
        create: 'POST /api/budgets',
        get: 'GET /api/budgets/:id',
        update: 'PATCH /api/budgets/:id',
        delete: 'DELETE /api/budgets/:id',
      },
      transactions: {
        list: 'GET /api/budgets/:budgetId/transactions',
        create: 'POST /api/budgets/:budgetId/transactions',
        delete: 'DELETE /api/budgets/:budgetId/transactions/:id',
      },
    },
  });
});

// ─── Health Route ─────────────────────────────────────────────────────────────
app.use('/health', healthRouter);

// ─── API Routes (Standard /api & Backward-Compatible /api/v1) ─────────────────
app.use('/api/auth', authRouter);
app.use('/api/v1/auth', authRouter);

app.use('/api/budgets', budgetRouter);
app.use('/api/v1/budget', budgetRouter);
app.use('/api/v1/budgets', budgetRouter);

app.use('/api/transactions', transactionsRouter);
app.use('/api/v1/transactions', transactionsRouter);

// ─── 404 Route Handler ────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
  });
});

// ─── Central Error Handler (must be last) ────────────────────────────────────
app.use(errorHandler);

export default app;
