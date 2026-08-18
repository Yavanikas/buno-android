import { TransactionProvider, SyncedTransaction, ProviderAccount } from './TransactionProvider';

/**
 * Concrete TransactionProvider that talks to the local simulated Demo Bank.
 * All provider-specific knowledge (URLs, response shape) lives here.
 */
export class DemoBankProvider implements TransactionProvider {
  readonly name = 'DemoBank';

  private baseUrl(): string {
    return (process.env.DEMO_BANK_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  }

  async getOrCreateAccount(userId: string): Promise<ProviderAccount> {
    const response = await fetch(`${this.baseUrl()}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      throw new Error(`Demo Bank account creation failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { account?: ProviderAccount };
    const account = data.account;
    if (!account?.id) {
      throw new Error('Demo Bank returned no account id');
    }
    return {
      id: account.id,
      name: account.name || 'Demo Bank Checking',
      currency: account.currency || 'INR',
      type: account.type || 'checking',
    };
  }

  async fetchTransactions(accountId: string): Promise<SyncedTransaction[]> {
    const response = await fetch(`${this.baseUrl()}/accounts/${encodeURIComponent(accountId)}/transactions`);
    if (!response.ok) {
      throw new Error(`Demo Bank fetch error: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { transactions?: SyncedTransaction[] };
    return (data.transactions || []) as SyncedTransaction[];
  }

  async acknowledgeSync(syncId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl()}/sync/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncId }),
    });
    if (!response.ok) {
      throw new Error(`Demo Bank acknowledge error: ${response.status} ${response.statusText}`);
    }
    return true;
  }
}
