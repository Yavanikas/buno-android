import { PrismaClient } from '@prisma/client';

// In-Memory Data Store for local testing/dev when Postgres is not available
class InMemoryStore {
  users: any[] = [];
  budgets: any[] = [];
  transactions: any[] = [];
  refreshTokens: any[] = [];
  auditLogs: any[] = [];

  private generateId(prefix: string = 'c'): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  user = {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) return this.users.find((u) => u.id === where.id) || null;
      if (where.email) return this.users.find((u) => u.email.toLowerCase() === where.email?.toLowerCase()) || null;
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const user = {
        id: this.generateId('usr'),
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(user);
      return user;
    },
    findMany: async () => [...this.users],
  };

  refreshToken = {
    findUnique: async ({ where }: { where: { token?: string; id?: string } }) => {
      if (where.token) return this.refreshTokens.find((r) => r.token === where.token) || null;
      if (where.id) return this.refreshTokens.find((r) => r.id === where.id) || null;
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const token = {
        id: this.generateId('tok'),
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
      };
      this.refreshTokens.push(token);
      return token;
    },
    delete: async ({ where }: { where: { id?: string; token?: string } }) => {
      const idx = this.refreshTokens.findIndex((r) => r.id === where.id || r.token === where.token);
      if (idx !== -1) {
        const deleted = this.refreshTokens[idx];
        this.refreshTokens.splice(idx, 1);
        return deleted;
      }
      return null;
    },
    deleteMany: async ({ where }: { where: { token?: string; userId?: string } }) => {
      const initialLen = this.refreshTokens.length;
      this.refreshTokens = this.refreshTokens.filter(
        (r) =>
          (where.token && r.token !== where.token) ||
          (where.userId && r.userId !== where.userId)
      );
      return { count: initialLen - this.refreshTokens.length };
    },
  };

  budget = {
    findMany: async ({ where, include, orderBy }: any = {}) => {
      let list = this.budgets.filter((b) => !where?.userId || b.userId === where.userId);
      if (include?.transactions) {
        list = list.map((b) => ({
          ...b,
          transactions: this.transactions
            .filter((t) => t.budgetId === b.id && t.userId === b.userId)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        }));
      }
      return list;
    },
    findUnique: async ({ where, include }: any) => {
      const budget = this.budgets.find((b) => b.id === where.id);
      if (!budget) return null;
      if (include?.transactions) {
        return {
          ...budget,
          transactions: this.transactions
            .filter((t) => t.budgetId === budget.id && t.userId === budget.userId)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        };
      }
      return budget;
    },
    upsert: async ({ where, update, create, include }: any) => {
      const existingIdx = this.budgets.findIndex(
        (b) =>
          b.userId === where.userId_month_year?.userId &&
          b.month === where.userId_month_year?.month &&
          b.year === where.userId_month_year?.year
      );

      let budget: any;
      if (existingIdx !== -1) {
        this.budgets[existingIdx] = {
          ...this.budgets[existingIdx],
          ...update,
          updatedAt: new Date(),
        };
        budget = this.budgets[existingIdx];
      } else {
        budget = {
          id: this.generateId('bdg'),
          userId: create.userId,
          monthlyLimit: create.monthlyLimit,
          currency: create.currency || 'INR',
          month: create.month,
          year: create.year,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.budgets.push(budget);
      }

      if (include?.transactions) {
        budget = {
          ...budget,
          transactions: this.transactions.filter(
            (t) => t.budgetId === budget.id && t.userId === budget.userId
          ),
        };
      }
      return budget;
    },
    update: async ({ where, data, include }: any) => {
      const idx = this.budgets.findIndex((b) => b.id === where.id);
      if (idx === -1) throw new Error('Budget not found');
      this.budgets[idx] = {
        ...this.budgets[idx],
        ...data,
        updatedAt: new Date(),
      };
      let budget = this.budgets[idx];
      if (include?.transactions) {
        budget = {
          ...budget,
          transactions: this.transactions.filter(
            (t) => t.budgetId === budget.id && t.userId === budget.userId
          ),
        };
      }
      return budget;
    },
    delete: async ({ where }: any) => {
      const idx = this.budgets.findIndex((b) => b.id === where.id);
      if (idx !== -1) {
        const deleted = this.budgets[idx];
        this.budgets.splice(idx, 1);
        // Cascade delete transactions
        this.transactions = this.transactions.filter((t) => t.budgetId !== where.id);
        return deleted;
      }
      throw new Error('Budget not found');
    },
  };

  transaction = {
    findMany: async ({ where, orderBy }: any = {}) => {
      let list = this.transactions.filter((t) => {
        if (where?.userId && t.userId !== where.userId) return false;
        if (where?.budgetId && t.budgetId !== where.budgetId) return false;
        return true;
      });
      if (orderBy?.date === 'desc') {
        list.sort((a, b) => b.date.getTime() - a.date.getTime());
      }
      return list;
    },
    findUnique: async ({ where }: any) => {
      return this.transactions.find((t) => t.id === where.id) || null;
    },
    create: async ({ data }: any) => {
      const tx = {
        id: this.generateId('tx'),
        userId: data.userId,
        budgetId: data.budgetId || null,
        amount: data.amount,
        category: data.category,
        note: data.note || null,
        date: data.date instanceof Date ? data.date : new Date(data.date || Date.now()),
        source: data.source || 'manual',
        externalId: data.externalId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.transactions.push(tx);
      return tx;
    },
    delete: async ({ where }: any) => {
      const idx = this.transactions.findIndex((t) => t.id === where.id);
      if (idx !== -1) {
        const deleted = this.transactions[idx];
        this.transactions.splice(idx, 1);
        return deleted;
      }
      throw new Error('Transaction not found');
    },
  };

  auditLog = {
    create: async ({ data }: any) => {
      const log = {
        id: this.generateId('aud'),
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        metadata: data.metadata || {},
        createdAt: new Date(),
      };
      this.auditLogs.push(log);
      return log;
    },
    findMany: async ({ where }: any = {}) => {
      return this.auditLogs.filter((l) => !where?.userId || l.userId === where.userId);
    },
  };
}

const memoryStore = new InMemoryStore();

// Use real Prisma if USE_REAL_PRISMA is set and valid, otherwise use memory store for dev/testing
const isMemoryMode = process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL || process.env.USE_MEMORY_DB === 'true';

export const prisma: any = isMemoryMode ? memoryStore : new PrismaClient();

export default prisma;
