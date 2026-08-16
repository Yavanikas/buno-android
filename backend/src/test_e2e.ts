import http from 'http';
import app from './app';

const PORT = 3099;
let server: http.Server;

function request(
  method: string,
  path: string,
  body?: any,
  token?: string
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
        port: PORT,
        path,
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
  } finally {
    server.close();
  }
}

runE2ETests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
