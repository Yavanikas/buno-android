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

// Routes
app.use('/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/budget', budgetRouter);
app.use('/api/v1/transactions', transactionsRouter);

// Central error handler (must be last)
app.use(errorHandler);

export default app;
