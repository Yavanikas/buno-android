export interface ProviderAccount {
  id: string;
  name: string;
  currency: string;
  type: string;
}

export interface SyncedTransaction {
  id: string; // The external id (used for duplicate detection)
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  description: string;
  date: string;
}

/**
 * Abstraction over a bank/account data provider.
 *
 * Business logic in the sync service must depend ONLY on this interface so
 * that concrete providers (e.g. Demo Bank) can be swapped without touching
 * the rest of the backend.
 */
export interface TransactionProvider {
  /**
   * Returns the name/identifier of the provider (e.g. "DemoBank").
   */
  readonly name: string;

  /**
   * Creates (or returns an existing) linked account for a given demo user.
   */
  getOrCreateAccount(userId: string): Promise<ProviderAccount>;

  /**
   * Fetches the latest transactions from the provider for an account.
   */
  fetchTransactions(accountId: string): Promise<SyncedTransaction[]>;

  /**
   * Acknowledges that the sync was successful.
   */
  acknowledgeSync(syncId: string): Promise<boolean>;
}
