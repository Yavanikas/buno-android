import { Router, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router({ mergeParams: true });

// ─── GET /api/budgets/:budgetId/transactions ─────────────────────────────────
router.get(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const budgetId = req.params.budgetId;

      if (budgetId) {
        // Verify budget ownership
        const budget = await prisma.budget.findUnique({
          where: { id: budgetId },
        });

        if (!budget || budget.userId !== req.userId) {
          res.status(404).json({
            status: 'error',
            message: 'Budget not found or access denied',
          });
          return;
        }

        const transactions = await prisma.transaction.findMany({
          where: {
            budgetId,
            userId: req.userId,
          },
          orderBy: { date: 'desc' },
        });

        res.status(200).json({
          status: 'success',
          data: transactions.map((t: any) => ({
            id: t.id,
            amount: Number(t.amount),
            category: t.category,
            note: t.note,
            date: t.date.toISOString(),
            source: t.source,
            budgetId: t.budgetId,
          })),
        });
      } else {
        // Fallback: list all user transactions
        const transactions = await prisma.transaction.findMany({
          where: { userId: req.userId },
          orderBy: { date: 'desc' },
        });

        res.status(200).json({
          status: 'success',
          data: transactions.map((t: any) => ({
            id: t.id,
            amount: Number(t.amount),
            category: t.category,
            note: t.note,
            date: t.date.toISOString(),
            source: t.source,
            budgetId: t.budgetId,
          })),
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/budgets/:budgetId/transactions ────────────────────────────────
router.post(
  '/',
  requireAuth,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('category').isString().trim().notEmpty().withMessage('Category is required'),
    body('note').optional().isString().trim(),
    body('date').optional().isISO8601().withMessage('Date must be a valid ISO 8601 string'),
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const budgetId = req.params.budgetId;
      const { amount, category, note, date } = req.body;

      let verifiedBudgetId: string | undefined = undefined;

      if (budgetId) {
        const budget = await prisma.budget.findUnique({
          where: { id: budgetId },
        });

        if (!budget || budget.userId !== req.userId) {
          res.status(404).json({
            status: 'error',
            message: 'Budget not found or access denied',
          });
          return;
        }
        verifiedBudgetId = budget.id;
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId: req.userId!,
          budgetId: verifiedBudgetId,
          amount,
          category: category.toLowerCase(),
          note: note || null,
          date: date ? new Date(date) : new Date(),
          source: 'manual',
        },
      });

      await logAudit({
        userId: req.userId!,
        action: 'TRANSACTION_CREATED',
        entity: 'Transaction',
        entityId: transaction.id,
        metadata: {
          budgetId: verifiedBudgetId,
          amount: Number(transaction.amount),
          category: transaction.category,
        },
      });

      res.status(201).json({
        status: 'success',
        data: {
          id: transaction.id,
          amount: Number(transaction.amount),
          category: transaction.category,
          note: transaction.note,
          date: transaction.date.toISOString(),
          source: transaction.source,
          budgetId: transaction.budgetId,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/budgets/:budgetId/transactions/:id ──────────────────────────
router.delete(
  '/:id',
  requireAuth,
  [param('id').notEmpty().withMessage('Transaction ID is required')],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { budgetId, id } = req.params;

      const transaction = await prisma.transaction.findUnique({
        where: { id },
      });

      if (!transaction || transaction.userId !== req.userId) {
        res.status(404).json({
          status: 'error',
          message: 'Transaction not found or access denied',
        });
        return;
      }

      if (budgetId && transaction.budgetId && transaction.budgetId !== budgetId) {
        res.status(404).json({
          status: 'error',
          message: 'Transaction does not belong to the specified budget',
        });
        return;
      }

      await prisma.transaction.delete({
        where: { id },
      });

      await logAudit({
        userId: req.userId!,
        action: 'TRANSACTION_DELETED',
        entity: 'Transaction',
        entityId: id,
      });

      res.status(200).json({
        status: 'success',
        message: 'Transaction deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
