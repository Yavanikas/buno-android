import http from 'http';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import app from './app';
import { getDeterministicAdvice } from './utils/spendingAdvice';

const PORT = 3099;
let server: http.Server;

function request(
  method: string,
  pathName: string,
  body?: any,
  token?: string,
  port: number = PORT
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathName,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode || 500,
              body: data ? JSON.parse(data) : {},
            });
          } catch (e) {
            resolve({
              status: res.statusCode || 500,
              body: { raw: data },
            });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

async function runE2ETests() {
  server = app.listen(PORT);
  console.log(`Starting E2E verification server on port ${PORT}...`);

  // Guarantee deterministic behavior until STEP 4B explicitly enables Groq.
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_BASE_URL;
  delete process.env.GROQ_MODEL;
  delete process.env.GROQ_TIMEOUT_MS;

  try {
    // 1. Health check
    console.log('\n--- 1. Health Check ---');
    const health = await request('GET', '/health');
    assert(health.status === 200, 'Health endpoint responds with 200');

    // 2. User 1 Registration
    console.log('\n--- 2. User 1 Registration ---');
    const regRes = await request('POST', '/api/auth/register', {
      email: 'user1@example.com',
      password: 'password123',
      name: 'User One',
    });
    assert(regRes.status === 201, 'User 1 registered successfully (201)');
    assert(regRes.body.status === 'success', 'Response status is "success"');
    assert(!!regRes.body.data.accessToken, 'Access token returned');
    assert(!!regRes.body.data.refreshToken, 'Refresh token returned');
    assert(regRes.body.data.user.email === 'user1@example.com', 'User email matches');

    let user1Token = regRes.body.data.accessToken;
    let user1RefreshToken = regRes.body.data.refreshToken;
    const user1Id = regRes.body.data.user.id;

    // Small delay so the JWT `iat` differs from registration (JWT has 1s granularity,
    // otherwise the refresh token would collide on the unique constraint).
    await new Promise((r) => setTimeout(r, 1200));

    // 3. User 1 Duplicate Registration rejection
    console.log('\n--- 3. Duplicate Registration Rejection ---');
    const dupReg = await request('POST', '/api/auth/register', {
      email: 'user1@example.com',
      password: 'password123',
    });
    assert(dupReg.status === 400, 'Duplicate registration rejected with 400');

    // 4. User 1 Login
    console.log('\n--- 4. User 1 Login ---');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'user1@example.com',
      password: 'password123',
    });
    assert(loginRes.status === 200, 'Login succeeded (200)');
    assert(!!loginRes.body.data.accessToken, 'Login returned accessToken');
    user1Token = loginRes.body.data.accessToken;
    user1RefreshToken = loginRes.body.data.refreshToken;

    // 5. Invalid credentials login
    console.log('\n--- 5. Invalid Credentials Rejection ---');
    const badLogin = await request('POST', '/api/auth/login', {
      email: 'user1@example.com',
      password: 'wrongpassword',
    });
    assert(badLogin.status === 401, 'Wrong password rejected with 401');

    // 6. GET /api/auth/me
    console.log('\n--- 6. GET /api/auth/me ---');
    const meRes = await request('GET', '/api/auth/me', undefined, user1Token);
    assert(meRes.status === 200, 'GET /me succeeded');
    assert(meRes.body.data.user.id === user1Id, 'User ID matches profile');

    // 7. Unauthenticated access rejection
    console.log('\n--- 7. Unauthenticated Access Rejection ---');
    const unauthRes = await request('GET', '/api/auth/me');
    assert(unauthRes.status === 401, 'Unauthorized request rejected with 401');

    // 8. Create Monthly Budget
    console.log('\n--- 8. Create Monthly Budget ---');
    const now = new Date();
    const createBudgetRes = await request(
      'POST',
      '/api/budgets',
      {
        monthlyLimit: 50000,
        currency: 'INR',
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      user1Token
    );
    assert(createBudgetRes.status === 201, 'Budget created (201)');
    assert(createBudgetRes.body.data.monthlyLimit === 50000, 'Monthly limit is 50000');
    assert(!!createBudgetRes.body.data.qualitativeState, 'Qualitative state generated');
    assert(createBudgetRes.body.data.qualitativeState.riskLabel === 'SAFE', 'Initial state is SAFE');

    const budgetId = createBudgetRes.body.data.id;

    // 9. List Budgets
    console.log('\n--- 9. GET /api/budgets ---');
    const listBudgetsRes = await request('GET', '/api/budgets', undefined, user1Token);
    assert(listBudgetsRes.status === 200, 'List budgets returned 200');
    assert(listBudgetsRes.body.data.length === 1, 'Found 1 budget');

    // 10. GET Budget by ID
    console.log('\n--- 10. GET /api/budgets/:id ---');
    const getBudgetRes = await request('GET', `/api/budgets/${budgetId}`, undefined, user1Token);
    assert(getBudgetRes.status === 200, 'Get budget by ID returned 200');
    assert(getBudgetRes.body.data.id === budgetId, 'Budget ID matches');

    // 11. Add Transactions to Budget
    console.log('\n--- 11. POST Transactions ---');
    const tx1 = await request(
      'POST',
      `/api/budgets/${budgetId}/transactions`,
      {
        amount: 450.0,
        category: 'Food',
        note: 'Team lunch',
        date: new Date().toISOString(),
      },
      user1Token
    );
    assert(tx1.status === 201, 'Transaction 1 added (201)');
    const tx1Id = tx1.body.data.id;

    const tx2 = await request(
      'POST',
      `/api/budgets/${budgetId}/transactions`,
      {
        amount: 150.0,
        category: 'Transport',
        note: 'Taxi ride',
        date: new Date().toISOString(),
      },
      user1Token
    );
    assert(tx2.status === 201, 'Transaction 2 added (201)');
    const tx2Id = tx2.body.data.id;

    const tx3 = await request(
      'POST',
      `/api/budgets/${budgetId}/transactions`,
      {
        amount: 1200.0,
        category: 'Groceries',
        note: 'Weekly essentials',
        date: new Date().toISOString(),
      },
      user1Token
    );
    assert(tx3.status === 201, 'Transaction 3 added (201)');

    // 12. GET Transactions for Budget
    console.log('\n--- 12. GET /api/budgets/:budgetId/transactions ---');
    const listTxRes = await request(
      'GET',
      `/api/budgets/${budgetId}/transactions`,
      undefined,
      user1Token
    );
    assert(listTxRes.status === 200, 'Transactions fetched');
    assert(listTxRes.body.data.length === 3, 'Found 3 transactions in budget');

    // 13. DELETE Transaction
    console.log('\n--- 13. DELETE Transaction ---');
    const delTxRes = await request(
      'DELETE',
      `/api/budgets/${budgetId}/transactions/${tx2Id}`,
      undefined,
      user1Token
    );
    assert(delTxRes.status === 200, 'Transaction 2 deleted');

    const listTxAfterDel = await request(
      'GET',
      `/api/budgets/${budgetId}/transactions`,
      undefined,
      user1Token
    );
    assert(listTxAfterDel.body.data.length === 2, 'Found 2 transactions remaining');

    // 14. Authorization & Cross-user isolation checks
    console.log('\n--- 14. Cross-User Authorization Check ---');
    const regUser2 = await request('POST', '/api/auth/register', {
      email: 'user2@example.com',
      password: 'password123',
      name: 'User Two',
    });
    const user2Token = regUser2.body.data.accessToken;

    const u2AccessU1Budget = await request('GET', `/api/budgets/${budgetId}`, undefined, user2Token);
    assert(u2AccessU1Budget.status === 404, 'User 2 denied access to User 1 budget (404)');

    const u2AccessU1Tx = await request(
      'GET',
      `/api/budgets/${budgetId}/transactions`,
      undefined,
      user2Token
    );
    assert(u2AccessU1Tx.status === 404, 'User 2 denied access to User 1 transactions (404)');

    const u2AddTxU1 = await request(
      'POST',
      `/api/budgets/${budgetId}/transactions`,
      { amount: 99, category: 'Food' },
      user2Token
    );
    assert(u2AddTxU1.status === 404, 'User 2 cannot post transactions to User 1 budget (404)');

    // 15. Token Refresh Flow
    console.log('\n--- 15. Token Refresh Flow ---');
    const refreshRes = await request('POST', '/api/auth/refresh', {
      refreshToken: user1RefreshToken,
    });
    assert(refreshRes.status === 200, 'Token refreshed successfully');
    assert(!!refreshRes.body.data.accessToken, 'New access token received');
    const newUser1Token = refreshRes.body.data.accessToken;

    const meAfterRefresh = await request('GET', '/api/auth/me', undefined, newUser1Token);
    assert(meAfterRefresh.status === 200, 'New token works for authenticated requests');

    // 16. Logout & Invalidation
    console.log('\n--- 16. Logout ---');
    const logoutRes = await request(
      'POST',
      '/api/auth/logout',
      { refreshToken: refreshRes.body.data.refreshToken },
      newUser1Token
    );
    assert(logoutRes.status === 200, 'Logged out successfully');

    // 17. Re-login
    console.log('\n--- 17. Re-login ---');
    const reloginRes = await request('POST', '/api/auth/login', {
      email: 'user1@example.com',
      password: 'password123',
    });
    assert(reloginRes.status === 200, 'Re-login succeeded');
    const reUser1Token = reloginRes.body.data.accessToken;

    const persistedBudget = await request('GET', '/api/budgets', undefined, reUser1Token);
    assert(persistedBudget.body.data.length === 1, 'Persisted budget intact after re-login');

    console.log('\n🎉 ALL BACKEND END-TO-END STEP 2 VERIFICATION TESTS PASSED!\n');

    // STEP 3: Demo Bank + Automatic Transaction Sync verification
    await runStep3SyncVerification();

    // STEP 4A: Backend Spending Intelligence verification
    await runStep4IntelligenceVerification();

    // STEP 4B: Groq AI + Response Safety verification
    await runStep4BVerification();
  } finally {
    await stopFakeGroq();
    server.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: DEMO BANK + AUTOMATIC TRANSACTION SYNC verification
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_BANK_PORT = 4100;
let demoBankProc: ChildProcess | null = null;

function spawnDemoBank(): void {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const entry = path.join(repoRoot, 'demobank', 'dist', 'server.js');
  demoBankProc = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(DEMO_BANK_PORT) },
    stdio: 'ignore',
  });
}

async function waitForDemoBank(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await request('GET', '/api/health', undefined, undefined, DEMO_BANK_PORT);
      if (res.status === 200 && res.body.status === 'ok') return;
    } catch (e) {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Demo Bank did not become healthy in time');
}

async function pollSyncStatus(syncId: string, token: string, maxAttempts = 40): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await request('GET', `/api/sync/${syncId}/status`, undefined, token);
    assert(res.status === 200, `Sync status poll returned 200 (attempt ${i + 1})`);
    if (res.body.status === 'success' || res.body.status === 'error') {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Sync did not finish in time');
}

async function runStep3SyncVerification(): Promise<void> {
  console.log('\n========== STEP 3: DEMO BANK + AUTOMATIC TRANSACTION SYNC ==========');

  // 0. Start the simulated Demo Bank service
  spawnDemoBank();
  await waitForDemoBank();
  process.env.DEMO_BANK_BASE_URL = `http://localhost:${DEMO_BANK_PORT}/api`;
  console.log(`✅ Demo Bank service running at ${process.env.DEMO_BANK_BASE_URL}`);

  // 1. Create a demo account (direct Demo Bank call)
  console.log('\n--- S3.1 Create demo account ---');
  const createAcc = await request('POST', '/api/accounts', { userId: 'step3-user' }, undefined, DEMO_BANK_PORT);
  assert(createAcc.status === 201, 'POST /api/accounts returns 201');
  assert(!!createAcc.body.account?.id, 'Account has an id');
  assert(createAcc.body.account.simulated === true, 'Account flagged as simulated');
  const accountId = createAcc.body.account.id;
  console.log(`✅ Demo account created: ${accountId}`);

  // 2. Fetch demo transactions (direct Demo Bank call)
  console.log('\n--- S3.2 Fetch demo transactions ---');
  const txRes = await request('GET', `/api/accounts/${accountId}/transactions`, undefined, undefined, DEMO_BANK_PORT);
  assert(txRes.status === 200, 'GET transactions returns 200');
  assert(txRes.body.simulated === true, 'Transactions flagged as simulated');
  const demoTx = txRes.body.transactions || [];
  assert(demoTx.length > 100, `Got ~60 days of realistic data (${demoTx.length} transactions)`);
  const categories = new Set(demoTx.map((t: any) => t.category));
  for (const c of ['Income', 'Groceries', 'Food', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'Personal Care', 'Healthcare', 'Education']) {
    assert(categories.has(c), `Category "${c}" present in demo data`);
  }
  const hasCredit = demoTx.some((t: any) => t.type === 'credit');
  assert(hasCredit, 'Income (credit) transactions present');
  console.log(`✅ Fetched ${demoTx.length} deterministic demo transactions across ${categories.size} categories`);

  // 3. Sync through the Buno backend
  console.log('\n--- S3.3 Sync through Buno backend ---');
  const reg = await request('POST', '/api/auth/register', {
    email: 'step3@example.com',
    password: 'password123',
    name: 'Step 3 User',
  });
  assert(reg.status === 201, 'Step 3 user registered');
  const token = reg.body.data.accessToken;
  const now = new Date();
  const budget = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 50000, currency: 'INR', month: now.getMonth() + 1, year: now.getFullYear() },
    token
  );
  assert(budget.status === 201, 'Step 3 budget created');
  const budgetId = budget.body.data.id;

  const start = await request('POST', `/api/budgets/${budgetId}/sync/start`, {}, token);
  assert(start.status === 202, 'POST sync/start returns 202 Accepted');
  assert(!!start.body.syncId, 'syncId returned');
  assert(start.body.provider === 'DemoBank', 'Provider identified as DemoBank');
  const syncId = start.body.syncId;

  const status = await pollSyncStatus(syncId, token);
  assert(status.status === 'success', 'Sync completed successfully');
  assert(!!status.accountId, 'Sync record carries the linked Demo Bank account');
  assert(status.transactionsFetched > 0, 'transactionsFetched > 0');
  assert(status.transactionsCreated === status.transactionsFetched, 'All fetched transactions were created');
  assert(status.duplicatesSkipped === 0, 'No duplicates on first sync');

  // Fetch the SAME account the sync used to cross-check the counts.
  const syncTx = await request('GET', `/api/accounts/${status.accountId}/transactions`, undefined, undefined, DEMO_BANK_PORT);
  const syncDemoTx = syncTx.body.transactions || [];
  assert(status.transactionsFetched === syncDemoTx.length, 'transactionsFetched matches the synced Demo Bank account');
  console.log(`✅ Sync success: fetched=${status.transactionsFetched} created=${status.transactionsCreated} skipped=${status.duplicatesSkipped}`);

  // 4. Verify transactions are stored in PostgreSQL
  console.log('\n--- S3.4 Verify transactions stored ---');
  const stored = await request('GET', `/api/budgets/${budgetId}/transactions`, undefined, token);
  assert(stored.status === 200, 'Stored transactions fetchable');
  assert(stored.body.data.length === status.transactionsCreated, `Stored ${stored.body.data.length} transactions`);
  const allDemobank = stored.body.data.every((t: any) => t.source === 'demobank');
  assert(allDemobank, 'All synced transactions have source=demobank');
  const storedCategories = new Set(stored.body.data.map((t: any) => t.category));
  assert(storedCategories.has('Income'), 'Income stored as category');
  assert(storedCategories.has('Groceries'), 'Groceries stored as category');
  console.log(`✅ ${stored.body.data.length} transactions persisted with source=demobank`);

  // 5. Android UI verification (manual on emulator)
  console.log('\n--- S3.5 Android UI ---');
  console.log('ℹ️ Manual step: open the Android app → Connect Bank → demo disclaimer → Connect → syncing → success → View Transactions.');

  // 6. Run sync again → duplicates must be skipped
  console.log('\n--- S3.6 Run sync again (duplicate detection) ---');
  const start2 = await request('POST', `/api/budgets/${budgetId}/sync/start`, {}, token);
  const syncId2 = start2.body.syncId;
  const status2 = await pollSyncStatus(syncId2, token);
  assert(status2.status === 'success', 'Second sync completed');
  assert(status2.transactionsCreated === 0, 'No new transactions created on second sync');
  assert(status2.duplicatesSkipped === status.transactionsFetched, 'All fetched transactions were skipped as duplicates');
  console.log(`✅ Duplicate detection: created=0, skipped=${status2.duplicatesSkipped}`);

  // 7. Demo Bank unavailable → graceful error handling
  console.log('\n--- S3.7 Demo Bank unavailable → graceful error ---');
  if (demoBankProc) {
    demoBankProc.kill();
    demoBankProc = null;
    await new Promise((r) => setTimeout(r, 500));
  }
  const start3 = await request('POST', `/api/budgets/${budgetId}/sync/start`, {}, token);
  assert(start3.status === 202, 'Sync start still accepted when provider is down');
  const syncId3 = start3.body.syncId;
  const status3 = await pollSyncStatus(syncId3, token);
  assert(status3.status === 'error', 'Sync marked as error when Demo Bank unavailable');
  assert(!!status3.error, 'Sync record carries an error message');
  console.log(`✅ Graceful failure handled: status=${status3.status}, error="${status3.error}"`);

  console.log('\n🎉 STEP 3 SYNC VERIFICATION TESTS PASSED!\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4A: BACKEND SPENDING INTELLIGENCE verification
// "Hide the number, reveal the signal." These endpoints must never expose exact
// remaining-budget values (spentSoFar, remainingBudget, balances, allowances).
// ─────────────────────────────────────────────────────────────────────────────
async function runStep4IntelligenceVerification(): Promise<void> {
  console.log('\n========== STEP 4A: BACKEND SPENDING INTELLIGENCE ==========');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const pastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const pastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // 0. Register a dedicated user
  const reg = await request('POST', '/api/auth/register', {
    email: 'step4@example.com',
    password: 'password123',
    name: 'Step 4 User',
  });
  assert(reg.status === 201, 'Step 4 user registered');
  const token = reg.body.data.accessToken;

  // 1. Empty history is handled safely
  console.log('\n--- S4.1 State on empty history ---');
  const budgetRes = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 50000, currency: 'INR', month: currentMonth, year: currentYear },
    token
  );
  assert(budgetRes.status === 201, 'Step 4 budget created');
  const budgetId = budgetRes.body.data.id;

  const emptyState = await request('POST', `/api/budgets/${budgetId}/state`, {}, token);
  assert(emptyState.status === 200, 'POST /state on empty budget returns 200');
  assert(['safe', 'watchful', 'fragile'].includes(emptyState.body.data.riskLabel), 'State returns a valid qualitative risk label');
  assert(emptyState.body.data.expensesLogged === 0, 'Empty history reports 0 expenses logged');
  assert(emptyState.body.data.spentSoFar === undefined, 'State hides spentSoFar');
  assert(emptyState.body.data.remainingBudget === undefined, 'State hides remainingBudget');
  assert(emptyState.body.data.remainingBalance === undefined, 'State hides remainingBalance');
  assert(emptyState.body.data.balance === undefined, 'State hides balance');
  assert(emptyState.body.data.allowance === undefined, 'State hides exact allowance');

  // 2. Expenses are counted
  console.log('\n--- S4.2 Expenses counted ---');
  await request(
    'POST',
    `/api/budgets/${budgetId}/transactions`,
    { amount: 500, category: 'Food', note: 'Lunch', date: now.toISOString() },
    token
  );
  await request(
    'POST',
    `/api/budgets/${budgetId}/transactions`,
    { amount: 1000, category: 'Groceries', note: 'Weekly essentials', date: now.toISOString() },
    token
  );
  const stateWithTx = await request('POST', `/api/budgets/${budgetId}/state`, {}, token);
  assert(stateWithTx.body.data.expensesLogged === 2, 'State counts logged expenses');

  // 3. Income must not be counted as an expense
  console.log('\n--- S4.3 Income excluded ---');
  await request(
    'POST',
    `/api/budgets/${budgetId}/transactions`,
    { amount: 50000, category: 'Income', note: 'Salary', date: now.toISOString() },
    token
  );
  const stateAfterIncome = await request('POST', `/api/budgets/${budgetId}/state`, {}, token);
  assert(stateAfterIncome.body.data.expensesLogged === 2, 'Income is not counted as an expense');
  const patternsWithIncome = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, token);
  assert(patternsWithIncome.body.data.recentExpenseCount === 2, 'Income excluded from pattern analysis');

  // 4. Patterns response is structured and qualitative
  console.log('\n--- S4.4 Patterns response structured ---');
  const patterns = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, token);
  assert(patterns.status === 200, 'POST /patterns returns 200');
  assert(patterns.body.data.recentExpenseCount === 2, 'Patterns count recent expenses');
  assert(typeof patterns.body.data.topCategoryByFrequency === 'string', 'Patterns include a top category by frequency');
  assert(typeof patterns.body.data.topCategoryByTotalSpend === 'string', 'Patterns include a top category by spend');
  assert(typeof patterns.body.data.spendingRhythm === 'string', 'Patterns include a spending rhythm');
  assert(Array.isArray(patterns.body.data.expenseSample), 'Patterns include an expense sample');
  assert(patterns.body.data.expenseSample.length > 0, 'Expense sample is populated');
  const sampleSizes: string[] = (patterns.body.data.expenseSample || []).map((s: any) => String(s?.size));
  for (const size of sampleSizes) {
    assert(['small', 'medium', 'larger'].includes(size), 'Expense sample sizes are qualitative buckets only');
  }
  assert(patterns.body.data.spentSoFar === undefined, 'Patterns hide spentSoFar');
  assert(patterns.body.data.totalSpent === undefined, 'Patterns hide totalSpent');
  assert(patterns.body.data.remainingBudget === undefined, 'Patterns hide remainingBudget');

  // 5. Signals are scoped to the requested budget
  console.log('\n--- S4.5 Budget scoping ---');
  const otherBudget = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 30000, currency: 'INR', month: nextMonth, year: nextMonthYear },
    token
  );
  assert(otherBudget.status === 201, 'Other-month budget created');
  await request(
    'POST',
    `/api/budgets/${otherBudget.body.data.id}/transactions`,
    { amount: 9999, category: 'Shopping', date: now.toISOString() },
    token
  );
  const stateScoped = await request('POST', `/api/budgets/${budgetId}/state`, {}, token);
  assert(stateScoped.body.data.expensesLogged === 2, 'State stays scoped to the budget (other budget ignored)');
  const otherPatterns = await request('POST', `/api/budgets/${otherBudget.body.data.id}/patterns`, {}, token);
  assert(otherPatterns.body.data.recentExpenseCount === 1, 'Other budget patterns reflect only its own transactions');

  // 6. Insufficient data falls back gracefully
  console.log('\n--- S4.6 Insufficient-data fallback ---');
  const emptyBudget = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 40000, currency: 'INR', month: pastMonth, year: pastMonthYear },
    token
  );
  const emptyPatterns = await request('POST', `/api/budgets/${emptyBudget.body.data.id}/patterns`, {}, token);
  assert(emptyPatterns.status === 200, 'Patterns on empty history returns 200');
  assert(emptyPatterns.body.data.recentExpenseCount === 0, 'Empty history reports 0 recent expenses');
  assert(emptyPatterns.body.data.topCategoryByFrequency === 'not enough data', 'Fallback: top category is "not enough data"');
  assert(emptyPatterns.body.data.spendingRhythm === 'not enough data', 'Fallback: spending rhythm is "not enough data"');
  const emptyAdvice = await request('POST', `/api/budgets/${emptyBudget.body.data.id}/advice`, {}, token);
  assert(emptyAdvice.status === 200, 'Advice on empty history returns 200');

  // 7. Zero remaining days must not divide by zero
  console.log('\n--- S4.7 Zero remaining days handled ---');
  const pastBudget = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 20000, currency: 'INR', month: 1, year: 2024 },
    token
  );
  assert(pastBudget.status === 201, 'Fully-past budget created');
  const pastState = await request('POST', `/api/budgets/${pastBudget.body.data.id}/state`, {}, token);
  assert(pastState.status === 200, 'State on a fully-past budget does not crash');
  const pastPatterns = await request('POST', `/api/budgets/${pastBudget.body.data.id}/patterns`, {}, token);
  assert(pastPatterns.status === 200, 'Patterns on a fully-past budget does not crash');
  assert(pastPatterns.body.data.daysRemaining === 0, 'Past budget reports 0 remaining days');
  assert(pastPatterns.body.data.riskLabel === 'fragile', 'Past budget reports fragile risk');
  const pastAdvice = await request('POST', `/api/budgets/${pastBudget.body.data.id}/advice`, {}, token);
  assert(pastAdvice.status === 200, 'Advice on a fully-past budget does not crash');

  // 8. Advice is a deterministic, amount-free qualitative fallback
  console.log('\n--- S4.8 Advice deterministic fallback ---');
  const advice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(advice.status === 200, 'POST /advice returns 200');
  assert(typeof advice.body.data.paceSummary === 'string' && advice.body.data.paceSummary.length > 0, 'Advice includes paceSummary');
  assert(typeof advice.body.data.monthOutlook === 'string' && advice.body.data.monthOutlook.length > 0, 'Advice includes monthOutlook');
  assert(typeof advice.body.data.todaySuggestion === 'string' && advice.body.data.todaySuggestion.length > 0, 'Advice includes todaySuggestion');
  const adviceText = JSON.stringify(advice.body.data);
  assert(!/[$₹]|\brs\.?\b|\brupees?\b|\busd\b|\bdollars?\b|\bcents?\b|\b\d+\b/.test(adviceText), 'Advice contains no exact amounts or numbers');
  const adviceAgain = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(JSON.stringify(adviceAgain.body.data) === JSON.stringify(advice.body.data), 'Advice is deterministic across calls');

  // 9. Soft-deleted transactions are ignored (no phantom expenses)
  console.log('\n--- S4.9 Deleted transactions ignored ---');
  const txList = await request('GET', `/api/budgets/${budgetId}/transactions`, undefined, token);
  const delTarget = txList.body.data.find((t: any) => t.category === 'groceries');
  assert(!!delTarget, 'Found groceries transaction to delete');
  const delRes = await request('DELETE', `/api/budgets/${budgetId}/transactions/${delTarget.id}`, undefined, token);
  assert(delRes.status === 200, 'Transaction deleted');
  const stateAfterDelete = await request('POST', `/api/budgets/${budgetId}/state`, {}, token);
  assert(stateAfterDelete.body.data.expensesLogged === 1, 'Deleted transaction no longer counted in state');

  // 10. Cross-user isolation returns 404 for all intelligence endpoints
  console.log('\n--- S4.10 Cross-user isolation ---');
  const regU2 = await request('POST', '/api/auth/register', {
    email: 'step4b@example.com',
    password: 'password123',
    name: 'Step 4B User',
  });
  assert(regU2.status === 201, 'Second user registered');
  const u2Token = regU2.body.data.accessToken;
  const u2State = await request('POST', `/api/budgets/${budgetId}/state`, {}, u2Token);
  assert(u2State.status === 404, 'Cross-user /state denied (404)');
  const u2Patterns = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, u2Token);
  assert(u2Patterns.status === 404, 'Cross-user /patterns denied (404)');
  const u2Advice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, u2Token);
  assert(u2Advice.status === 404, 'Cross-user /advice denied (404)');

  // 11. Unauthenticated requests are rejected
  console.log('\n--- S4.11 Unauthenticated rejected ---');
  const noAuthState = await request('POST', `/api/budgets/${budgetId}/state`, {});
  assert(noAuthState.status === 401, 'Unauthenticated /state rejected (401)');
  const noAuthPatterns = await request('POST', `/api/budgets/${budgetId}/patterns`, {});
  assert(noAuthPatterns.status === 401, 'Unauthenticated /patterns rejected (401)');

  console.log('\n🎉 STEP 4A SPENDING INTELLIGENCE VERIFICATION TESTS PASSED!\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4B: GROQ AI + RESPONSE SAFETY verification
// A local fake Groq endpoint lets us exercise valid, malformed, slow, failing,
// and leaking provider responses without touching the real API.
// ─────────────────────────────────────────────────────────────────────────────
const FAKE_GROQ_PORT = 4200;
let fakeGroqServer: http.Server | null = null;
let fakeGroqMode: string = 'error';
let fakeGroqLastAuth: string = '';
let fakeGroqLastBody: string = '';

function respondJson(res: http.ServerResponse, status: number, payload: unknown): void {
  try {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (e) {
    // socket may already be destroyed after a client abort — ignore
  }
}

function startFakeGroq(): Promise<void> {
  return new Promise((resolve, reject) => {
    fakeGroqServer = http.createServer((req, res) => {
      res.on('error', () => {});
      req.on('error', () => {});

      if (req.method !== 'POST' || !['/chat/completions', '/v1/chat/completions'].includes(req.url || '')) {
        respondJson(res, 404, { error: 'not found' });
        return;
      }

      fakeGroqLastAuth = String(req.headers.authorization || '');
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        fakeGroqLastBody = body;

        if (fakeGroqMode === 'slow') {
          setTimeout(
            () =>
              respondJson(res, 200, {
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        paceSummary: 'too late',
                        monthOutlook: 'too late',
                        todaySuggestion: 'too late',
                      }),
                    },
                  },
                ],
              }),
            5000
          );
          return;
        }

        if (fakeGroqMode === 'error') {
          respondJson(res, 500, { error: 'simulated provider failure' });
          return;
        }

        if (fakeGroqMode === 'malformed') {
          respondJson(res, 200, {
            choices: [{ message: { content: 'this is definitely not json' } }],
          });
          return;
        }

        if (fakeGroqMode === 'empty') {
          respondJson(res, 200, { choices: [{ message: { content: '' } }] });
          return;
        }

        if (fakeGroqMode === 'symbol') {
          respondJson(res, 200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paceSummary: 'You have ₹3,200 left.',
                    monthOutlook: 'Fine.',
                    todaySuggestion: 'Relax.',
                  }),
                },
              },
            ],
          });
          return;
        }

        if (fakeGroqMode === 'amount') {
          respondJson(res, 200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paceSummary: 'You can spend 200 today.',
                    monthOutlook: 'Fine.',
                    todaySuggestion: 'Relax.',
                  }),
                },
              },
            ],
          });
          return;
        }

        if (fakeGroqMode === 'remaining') {
          respondJson(res, 200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paceSummary: 'Your remaining balance is 4500.',
                    monthOutlook: 'Fine.',
                    todaySuggestion: 'Relax.',
                  }),
                },
              },
            ],
          });
          return;
        }

        if (fakeGroqMode === 'percent') {
          respondJson(res, 200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paceSummary: 'You have used 40 percent of your budget.',
                    monthOutlook: 'Fine.',
                    todaySuggestion: 'Relax.',
                  }),
                },
              },
            ],
          });
          return;
        }

        if (fakeGroqMode === 'bad-tag') {
          respondJson(res, 200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    patternTag: 'Invented pattern',
                    insight: 'Weekend spending seems higher recently.',
                    confidence: 'high',
                  }),
                },
              },
            ],
          });
          return;
        }

        if (fakeGroqMode === 'valid-pattern') {
          respondJson(res, 200, {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    patternTag: 'Weekend pattern',
                    insight: 'Weekend spending seems a bit higher than weekdays recently.',
                    confidence: 'medium',
                  }),
                },
              },
            ],
          });
          return;
        }

        // default: valid qualitative advice
        respondJson(res, 200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  paceSummary: 'Recent spending seems calm and steady.',
                  monthOutlook: 'At this pace the month looks comfortable.',
                  todaySuggestion: 'Keep one light day today to stay flexible.',
                }),
              },
            },
          ],
        });
      });
    });

    fakeGroqServer.once('error', reject);
    fakeGroqServer.listen(FAKE_GROQ_PORT, () => resolve());
  });
}

function stopFakeGroq(): Promise<void> {
  return new Promise((resolve) => {
    if (!fakeGroqServer) {
      resolve();
      return;
    }
    const toClose = fakeGroqServer;
    fakeGroqServer = null;
    toClose.close(() => resolve());
  });
}

async function runStep4BVerification(): Promise<void> {
  console.log('\n========== STEP 4B: GROQ AI + RESPONSE SAFETY ==========');

  // 0. Fresh user + budget with real activity
  const reg = await request('POST', '/api/auth/register', {
    email: 'step4c@example.com',
    password: 'password123',
    name: 'Step 4C User',
  });
  assert(reg.status === 201, 'Step 4C user registered');
  const token = reg.body.data.accessToken;

  const now = new Date();
  const budget = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 60000, currency: 'INR', month: now.getMonth() + 1, year: now.getFullYear() },
    token
  );
  assert(budget.status === 201, 'Step 4C budget created');
  const budgetId = budget.body.data.id;

  await request(
    'POST',
    `/api/budgets/${budgetId}/transactions`,
    { amount: 600, category: 'Food', note: 'Lunch', date: now.toISOString() },
    token
  );
  await request(
    'POST',
    `/api/budgets/${budgetId}/transactions`,
    { amount: 1200, category: 'Groceries', note: 'Weekly essentials', date: now.toISOString() },
    token
  );

  // S4B.11 baseline: deterministic fallback when Groq is not configured
  console.log('\n--- S4B.11 Deterministic fallback baseline ---');
  delete process.env.GROQ_API_KEY;
  const baselineAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(baselineAdvice.status === 200, 'Advice without Groq returns 200');
  assert(
    baselineAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'No-key advice equals deterministic fallback'
  );

  // Start the fake Groq provider
  await startFakeGroq();
  process.env.GROQ_API_KEY = 'test-key-not-secret';
  process.env.GROQ_BASE_URL = `http://localhost:${FAKE_GROQ_PORT}/v1`;
  process.env.GROQ_TIMEOUT_MS = '2000';

  // S4B.1 + S4B.10: valid qualitative Groq advice is returned verbatim
  console.log('\n--- S4B.1/10 Valid qualitative Groq advice ---');
  fakeGroqMode = 'valid-advice';
  const aiAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(aiAdvice.status === 200, 'POST /advice returns 200 with Groq enabled');
  assert(
    aiAdvice.body.data.paceSummary === 'Recent spending seems calm and steady.',
    'Valid Groq advice is returned (not the fallback)'
  );
  assert(
    typeof aiAdvice.body.data.monthOutlook === 'string' && typeof aiAdvice.body.data.todaySuggestion === 'string',
    'Advice carries monthOutlook and todaySuggestion'
  );
  assert(!/[$₹€£¥\d]/.test(JSON.stringify(aiAdvice.body.data)), 'Valid advice contains no amounts or digits');

  // Groq request carries only the server key; context has no hidden financial state
  assert(fakeGroqLastAuth === 'Bearer test-key-not-secret', 'Groq request carries the server-side API key only');
  const sentToGroq = (fakeGroqLastBody || '').toLowerCase();
  assert(!sentToGroq.includes('remainingbudget'), 'Groq context never includes remainingBudget');
  assert(!sentToGroq.includes('spentsofar'), 'Groq context never includes spentSoFar');
  assert(!sentToGroq.includes('monthlylimit'), 'Groq context never includes monthlyLimit');
  assert(!sentToGroq.includes('"amount"'), 'Groq context never includes raw amounts');
  assert(
    !sentToGroq.includes('password') && !sentToGroq.includes('"token"'),
    'Groq context never includes secrets'
  );

  // S4B.2: malformed Groq JSON → deterministic fallback
  console.log('\n--- S4B.2 Malformed Groq response ---');
  fakeGroqMode = 'malformed';
  const malformedAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    malformedAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Malformed Groq output falls back deterministically'
  );

  // S4B.2b: valid JSON but missing/empty fields → deterministic fallback
  console.log('\n--- S4B.2b Empty Groq content ---');
  fakeGroqMode = 'empty';
  const emptyAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    emptyAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Empty Groq content falls back deterministically'
  );

  // S4B.3: Groq timeout → deterministic fallback
  console.log('\n--- S4B.3 Groq timeout ---');
  fakeGroqMode = 'slow';
  const slowAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    slowAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Groq timeout falls back deterministically'
  );

  // S4B.4: Groq unavailable → deterministic fallback
  console.log('\n--- S4B.4 Groq unavailable ---');
  await stopFakeGroq();
  const downAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    downAdvice.status === 200 && downAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Groq unavailable falls back deterministically'
  );
  await startFakeGroq();

  // S4B.5: missing GROQ_API_KEY → deterministic fallback
  console.log('\n--- S4B.5 Missing GROQ_API_KEY ---');
  delete process.env.GROQ_API_KEY;
  fakeGroqMode = 'valid-advice';
  const noKeyAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    noKeyAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Missing GROQ_API_KEY falls back deterministically'
  );
  process.env.GROQ_API_KEY = 'test-key-not-secret';

  // S4B.6: currency-symbol leakage → fallback
  console.log('\n--- S4B.6 Currency-symbol leakage ---');
  fakeGroqMode = 'symbol';
  const symbolAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    symbolAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Currency-symbol content is rejected'
  );

  // S4B.7: exact money amount → fallback
  console.log('\n--- S4B.7 Exact money amount leakage ---');
  fakeGroqMode = 'amount';
  const amountAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    amountAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Exact-amount content is rejected'
  );

  // S4B.8: remaining-balance statement → fallback
  console.log('\n--- S4B.8 Remaining-balance leakage ---');
  fakeGroqMode = 'remaining';
  const remainingAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    remainingAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Remaining-balance statement is rejected'
  );

  // S4B.9: percentage leakage → fallback
  console.log('\n--- S4B.9 Percentage leakage ---');
  fakeGroqMode = 'percent';
  const percentAdvice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    percentAdvice.body.data.paceSummary === getDeterministicAdvice('safe').paceSummary,
    'Percentage content is rejected'
  );

  // S4B.11: fallback is stable and identical to the baseline
  console.log('\n--- S4B.11 Deterministic fallback stability ---');
  const fallbackAgain = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  assert(
    JSON.stringify(fallbackAgain.body.data) === JSON.stringify(baselineAdvice.body.data),
    'Fallback payload is deterministic and stable'
  );

  // /patterns: valid AI interpretation + invalid tag falls back
  console.log('\n--- S4B Patterns insight (valid + invalid) ---');
  fakeGroqMode = 'valid-pattern';
  const patternsOk = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, token);
  assert(patternsOk.status === 200, 'POST /patterns returns 200 with Groq enabled');
  assert(patternsOk.body.data.insight.patternTag === 'Weekend pattern', 'AI pattern tag is used');
  assert(patternsOk.body.data.insight.confidence === 'medium', 'AI confidence is used');
  assert(['low', 'medium', 'high'].includes(patternsOk.body.data.insight.confidence), 'Confidence is an allowed enum');
  assert(patternsOk.body.data.recentExpenseCount === 2, 'Deterministic pattern data remains the source of truth');
  assert(!/[$₹€£¥\d]/.test(patternsOk.body.data.insight.insight), 'Pattern insight contains no amounts or digits');

  fakeGroqMode = 'bad-tag';
  const patternsFallback = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, token);
  assert(
    patternsFallback.body.data.insight.patternTag === 'Recent activity',
    'Disallowed pattern tag falls back to the safe insight'
  );

  // Insufficient data → deterministic fallback insight without calling Groq
  console.log('\n--- S4B Patterns empty history fallback ---');
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const emptyBudget = await request(
    'POST',
    '/api/budgets',
    { monthlyLimit: 20000, currency: 'INR', month: prevMonth, year: prevYear },
    token
  );
  fakeGroqMode = 'valid-pattern';
  const emptyPatterns = await request('POST', `/api/budgets/${emptyBudget.body.data.id}/patterns`, {}, token);
  assert(emptyPatterns.body.data.insight.patternTag === 'Recent activity', 'Empty history uses deterministic fallback insight');

  // S4B.12: authenticated user can only reach their own budget
  console.log('\n--- S4B.12 Cross-user isolation with Groq active ---');
  const regU2 = await request('POST', '/api/auth/register', {
    email: 'step4d@example.com',
    password: 'password123',
    name: 'Step 4D User',
  });
  const u2Token = regU2.body.data.accessToken;
  const u2Advice = await request('POST', `/api/budgets/${budgetId}/advice`, {}, u2Token);
  assert(u2Advice.status === 404, 'Cross-user /advice denied (404)');
  const u2Patterns = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, u2Token);
  assert(u2Patterns.status === 404, 'Cross-user /patterns denied (404)');

  // S4B.13: API never returns internal calculation fields
  console.log('\n--- S4B.13 No internal calculation fields leak ---');
  fakeGroqMode = 'valid-advice';
  const advResp = await request('POST', `/api/budgets/${budgetId}/advice`, {}, token);
  const patResp = await request('POST', `/api/budgets/${budgetId}/patterns`, {}, token);
  for (const resp of [advResp, patResp]) {
    const dataText = JSON.stringify(resp.body.data).toLowerCase();
    for (const forbidden of [
      'spentsofar',
      'remainingbudget',
      'remainingbalance',
      'balance',
      'allowance',
      'monthlylimit',
      'totalbudget',
      'budgetremainder',
    ]) {
      assert(!dataText.includes(forbidden), `Response hides "${forbidden}"`);
    }
  }

  // Cleanup
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_BASE_URL;
  delete process.env.GROQ_MODEL;
  delete process.env.GROQ_TIMEOUT_MS;
  await stopFakeGroq();

  console.log('\n🎉 STEP 4B GROQ AI + RESPONSE SAFETY VERIFICATION TESTS PASSED!\n');
}

runE2ETests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
