import { Router, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { DemoBankProvider } from '../lib/sync/DemoBankProvider';
import { TransactionProvider, SyncedTransaction } from '../lib/sync/TransactionProvider';

const router = Router();

// The business logic depends ONLY on the TransactionProvider abstraction.
// Swap this for any other provider without touching the routes below.
const provider: TransactionProvider = new DemoBankProvider();

/**
 * Map a provider transaction onto our internal model:
 *   debit  → expense (stored under its category)
 *   credit → income
 */
function mapSyncedTransaction(tx: SyncedTransaction): { amount: number; category: string; note: string; date: Date } {
  const isIncome = tx.type === 'credit';
  return {
    amount: Math.abs(tx.amount),
    category: isIncome ? 'Income' : tx.category || 'Uncategorized',
    note: tx.description,
    date: new Date(tx.date),
  };
}

// POST /api/budgets/:budgetId/sync/start
router.post(
  '/budgets/:budgetId/sync/start',
  requireAuth,
  [param('budgetId').isString().notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const budgetId = req.params.budgetId;
      const userId = req.userId!;

      // 1. authenticate current user (requireAuth above) + 2. determine associated budget
      const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
      if (!budget || budget.userId !== userId) {
        res.status(404).json({ error: 'Budget not found or access denied' });
        return;
      }

      // 3. create sync record
      const syncRecord = await prisma.sync.create({
        data: {
          userId,
          budgetId,
          provider: provider.name,
          status: 'syncing',
        },
      });

      // Run the sync asynchronously so the caller is not blocked. In a real app
      // this would be offloaded to a queue / worker.
      void (async () => {
        try {
          // 4. fetch transactions from the provider
          const account = await provider.getOrCreateAccount(userId);
          const transactions = await provider.fetchTransactions(account.id);

          let created = 0;
          let duplicates = 0;

          // 5. map + 6. store + 7. detect duplicates via externalId
          for (const tx of transactions) {
            const existing = await prisma.transaction.findUnique({
              where: { externalId: tx.id },
            });
            if (existing) {
              duplicates++;
              continue;
            }

            const mapped = mapSyncedTransaction(tx);
            await prisma.transaction.create({
              data: {
                userId,
                budgetId,
                amount: mapped.amount,
                category: mapped.category,
                note: mapped.note,
                date: mapped.date,
                source: provider.name.toLowerCase(),
                externalId: tx.id,
              },
            });
            created++;
          }

          // 8. update sync counters + mark success
          await prisma.sync.update({
            where: { id: syncRecord.id },
            data: {
              status: 'success',
              accountId: account.id,
              transactionsFetched: transactions.length,
              transactionsCreated: created,
              duplicatesSkipped: duplicates,
              lastSyncAt: new Date(),
            },
          });

          // 9. acknowledge the provider-side sync
          await provider.acknowledgeSync(syncRecord.id);
        } catch (error: any) {
          console.error('[sync] process error:', error);
          await prisma.sync.update({
            where: { id: syncRecord.id },
            data: {
              status: 'error',
              error: error?.message || 'Unknown error during sync',
            },
          });
        }
      })();

      res.status(202).json({
        message: 'Sync started',
        syncId: syncRecord.id,
        provider: provider.name,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/sync/:syncId/status
router.get(
  '/sync/:syncId/status',
  requireAuth,
  [param('syncId').isString().notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const syncId = req.params.syncId;
      const userId = req.userId!;

      const syncRecord = await prisma.sync.findUnique({
        where: { id: syncId },
      });

      if (!syncRecord || syncRecord.userId !== userId) {
        res.status(404).json({ error: 'Sync record not found' });
        return;
      }

      res.json({
        id: syncRecord.id,
        status: syncRecord.status,
        provider: syncRecord.provider,
        accountId: syncRecord.accountId,
        transactionsFetched: syncRecord.transactionsFetched,
        transactionsCreated: syncRecord.transactionsCreated,
        duplicatesSkipped: syncRecord.duplicatesSkipped,
        lastSyncAt: syncRecord.lastSyncAt,
        error: syncRecord.error,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/sync/:syncId/acknowledge
// Called by the client once it has observed the sync result.
router.post(
  '/sync/:syncId/acknowledge',
  requireAuth,
  [param('syncId').isString().notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const syncId = req.params.syncId;
      const userId = req.userId!;

      const syncRecord = await prisma.sync.findUnique({
        where: { id: syncId },
      });

      if (!syncRecord || syncRecord.userId !== userId) {
        res.status(404).json({ error: 'Sync record not found' });
        return;
      }

      res.json({ message: 'Acknowledged', id: syncId });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
