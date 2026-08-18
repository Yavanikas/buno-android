import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import budgetRouter from './routes/budget';
import transactionsRouter from './routes/transactions';
import syncRouter from './routes/sync';

const app = express();

app.use(cors());
app.use(express.json());

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

app.use('/api', syncRouter); // since the route starts with /budgets and /sync
app.use('/api/v1', syncRouter);

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
