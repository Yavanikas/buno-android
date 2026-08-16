import { Router, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { computeQualitativeState } from '../utils/qualitative';
import { logAudit } from '../utils/audit';
import transactionsRouter from './transactions';

const router = Router();

// ─── Nested Transactions Router ──────────────────────────────────────────────
router.use('/:budgetId/transactions', transactionsRouter);

// ─── GET /api/budgets ────────────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const budgets = await prisma.budget.findMany({
        where: { userId: req.userId },
        include: {
          transactions: {
            orderBy: { date: 'desc' },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });

      const data = budgets.map((b: any) => {
        const qualitative = computeQualitativeState(
          Number(b.monthlyLimit),
          b.currency,
          (b.transactions || []).map((t: any) => ({ amount: Number(t.amount), date: t.date })),
          b.month,
          b.year
        );

        return {
          id: b.id,
          monthlyLimit: Number(b.monthlyLimit),
          currency: b.currency,
          month: b.month,
          year: b.year,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
          qualitativeState: qualitative,
        };
      });

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/budgets ───────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  [
    body('monthlyLimit').isFloat({ gt: 0 }).withMessage('Monthly limit must be greater than 0'),
    body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP']).withMessage('Unsupported currency'),
    body('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').optional().isInt({ min: 2020 }).withMessage('Year must be valid'),
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { monthlyLimit, currency = 'INR' } = req.body;
      const now = new Date();
      const month = req.body.month ? parseInt(req.body.month, 10) : now.getMonth() + 1;
      const year = req.body.year ? parseInt(req.body.year, 10) : now.getFullYear();

      // Upsert budget for (userId, month, year)
      const budget = await prisma.budget.upsert({
        where: {
          userId_month_year: {
            userId: req.userId!,
            month,
            year,
          },
        },
        update: {
          monthlyLimit,
          currency,
        },
        create: {
          userId: req.userId!,
          monthlyLimit,
          currency,
          month,
          year,
        },
        include: {
          transactions: true,
        },
      });

      const qualitative = computeQualitativeState(
        Number(budget.monthlyLimit),
        budget.currency,
        (budget.transactions || []).map((t: any) => ({ amount: Number(t.amount), date: t.date })),
        budget.month,
        budget.year
      );

      await logAudit({
        userId: req.userId!,
        action: 'BUDGET_CREATED',
        entity: 'Budget',
        entityId: budget.id,
        metadata: {
          monthlyLimit: Number(budget.monthlyLimit),
          currency: budget.currency,
          month,
          year,
        },
      });

      res.status(201).json({
        status: 'success',
        data: {
          id: budget.id,
          monthlyLimit: Number(budget.monthlyLimit),
          currency: budget.currency,
          month: budget.month,
          year: budget.year,
          createdAt: budget.createdAt.toISOString(),
          updatedAt: budget.updatedAt.toISOString(),
          qualitativeState: qualitative,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/budgets/:id ────────────────────────────────────────────────────
router.get(
  '/:id',
  requireAuth,
  [param('id').notEmpty().withMessage('Budget ID is required')],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const budget = await prisma.budget.findUnique({
        where: { id },
        include: {
          transactions: {
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!budget || budget.userId !== req.userId) {
        res.status(404).json({
          status: 'error',
          message: 'Budget not found or access denied',
        });
        return;
      }

      const qualitative = computeQualitativeState(
        Number(budget.monthlyLimit),
        budget.currency,
        (budget.transactions || []).map((t: any) => ({ amount: Number(t.amount), date: t.date })),
        budget.month,
        budget.year
      );

      res.status(200).json({
        status: 'success',
        data: {
          id: budget.id,
          monthlyLimit: Number(budget.monthlyLimit),
          currency: budget.currency,
          month: budget.month,
          year: budget.year,
          createdAt: budget.createdAt.toISOString(),
          updatedAt: budget.updatedAt.toISOString(),
          qualitativeState: qualitative,
          transactions: (budget.transactions || []).map((t: any) => ({
            id: t.id,
            amount: Number(t.amount),
            category: t.category,
            note: t.note,
            date: t.date.toISOString(),
            source: t.source,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/budgets/:id ──────────────────────────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  [
    param('id').notEmpty().withMessage('Budget ID is required'),
    body('monthlyLimit').optional().isFloat({ gt: 0 }).withMessage('Monthly limit must be greater than 0'),
    body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP']).withMessage('Unsupported currency'),
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { monthlyLimit, currency } = req.body;

      const existing = await prisma.budget.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== req.userId) {
        res.status(404).json({
          status: 'error',
          message: 'Budget not found or access denied',
        });
        return;
      }

      const updated = await prisma.budget.update({
        where: { id },
        data: {
          ...(monthlyLimit !== undefined ? { monthlyLimit } : {}),
          ...(currency !== undefined ? { currency } : {}),
        },
        include: {
          transactions: true,
        },
      });

      const qualitative = computeQualitativeState(
        Number(updated.monthlyLimit),
        updated.currency,
        (updated.transactions || []).map((t: any) => ({ amount: Number(t.amount), date: t.date })),
        updated.month,
        updated.year
      );

      await logAudit({
        userId: req.userId!,
        action: 'BUDGET_UPDATED',
        entity: 'Budget',
        entityId: id,
        metadata: {
          monthlyLimit: monthlyLimit ? Number(monthlyLimit) : undefined,
          currency,
        },
      });

      res.status(200).json({
        status: 'success',
        data: {
          id: updated.id,
          monthlyLimit: Number(updated.monthlyLimit),
          currency: updated.currency,
          month: updated.month,
          year: updated.year,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          qualitativeState: qualitative,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/budgets/:id ─────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  [param('id').notEmpty().withMessage('Budget ID is required')],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const existing = await prisma.budget.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== req.userId) {
        res.status(404).json({
          status: 'error',
          message: 'Budget not found or access denied',
        });
        return;
      }

      await prisma.budget.delete({
        where: { id },
      });

      await logAudit({
        userId: req.userId!,
        action: 'BUDGET_DELETED',
        entity: 'Budget',
        entityId: id,
      });

      res.status(200).json({
        status: 'success',
        message: 'Budget deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
