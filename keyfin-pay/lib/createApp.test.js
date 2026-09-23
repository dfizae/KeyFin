import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './createApp.js';
import { buildFinBody } from './finHeader.js';

function startServer({ finResult, rows } = {}) {
  const calls = [];
  const app = createApp({
    finBaseUrl: 'https://fin.example/api/v1',
    finApiKey: 'APIKEY-1',
    db: {
      query: async (sql) => {
        calls.push(sql);
        return [rows ?? [{ fin_merchant_id: 40779, name: '강남PC존', subcategory_name: '게임·콘텐츠' }]];
      },
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { json: async () => finResult ?? { userKey: 'UK-1', userName: 'tester', userId: 'a@b.c' } };
    },
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, calls, port: server.address().port }));
  });
}

async function post(port, path, body) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('buildFinBody assembles the common header and appends userKey', () => {
  const body = buildFinBody({
    url: 'https://fin.example/api/v1/edu/creditCard/createCreditCardTransaction',
    fields: { cardNo: '1', paymentBalance: '500' },
    apiKey: 'K',
    userKey: 'UK',
    now: new Date('2026-09-23T10:20:30'),
  });
  assert.equal(body.Header.apiName, 'createCreditCardTransaction');
  assert.equal(body.Header.apiServiceCode, 'createCreditCardTransaction');
  assert.equal(body.Header.transmissionDate, '20260923');
  assert.equal(body.Header.transmissionTime, '102030');
  assert.equal(body.Header.institutionCode, '00100');
  assert.equal(body.Header.apiKey, 'K');
  assert.equal(body.Header.userKey, 'UK');
  assert.match(body.Header.institutionTransactionUniqueNo, /^20260923102030\d{6}$/);
  assert.equal(body.cardNo, '1');
});

test('buildFinBody sends member APIs without a header, apiKey in the body', () => {
  const body = buildFinBody({ url: 'https://fin.example/api/v1/member/search', fields: { userId: 'a@b.c' }, apiKey: 'K' });
  assert.deepEqual(body, { userId: 'a@b.c', apiKey: 'K' });
});

test('GET /healthz reports UP without touching the DB or finance network', async () => {
  const { server, calls, port } = await startServer();
  const res = await fetch(`http://localhost:${port}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'UP' });
  assert.equal(calls.length, 0);
  server.close();
});

test('POST /api/login calls the finance network directly', async () => {
  const { server, calls, port } = await startServer();
  const { json } = await post(port, '/api/login', { userId: 'a@b.c' });
  assert.equal(json.ok, true);
  assert.equal(json.userKey, 'UK-1');
  const finCall = calls.find((c) => c.url);
  assert.equal(finCall.url, 'https://fin.example/api/v1/member/search');
  assert.equal(finCall.body.apiKey, 'APIKEY-1');
  server.close();
});

test('POST /api/login surfaces API errors as a message', async () => {
  const { server, port } = await startServer({
    finResult: { responseCode: 'E4003', responseMessage: '존재하지 않는 ID입니다.' },
  });
  const { json } = await post(port, '/api/login', { userId: 'none@b.c' });
  assert.equal(json.ok, false);
  assert.match(json.message, /존재하지 않는/);
  server.close();
});

test('GET /api/merchants maps join rows and caches the query', async () => {
  const { server, calls, port } = await startServer();
  const first = await (await fetch(`http://localhost:${port}/api/merchants`)).json();
  await (await fetch(`http://localhost:${port}/api/merchants`)).json();
  assert.deepEqual(first, [{ finMerchantId: 40779, name: '강남PC존', subcategoryName: '게임·콘텐츠' }]);
  const sql = calls.find((c) => typeof c === 'string');
  assert.match(sql, /MIN\(m\.fin_merchant_id\)/); // 중복 가맹점은 먼저 등록된 ID 하나만
  assert.match(sql, /GROUP BY m\.name, s\.name/);
  assert.equal(calls.filter((c) => typeof c === 'string').length, 1); // 두 번째 요청은 캐시
  server.close();
});

test('POST /api/fin/:action builds the header and rejects unknown actions', async () => {
  const { server, calls, port } = await startServer({ finResult: { Header: { responseCode: 'H0000' }, REC: [] } });
  const { json } = await post(port, '/api/fin/cards', { userKey: 'UK-1', fields: {} });
  assert.equal(json.ok, true);
  const finCall = calls.find((c) => c.url);
  assert.match(finCall.url, /inquireSignUpCreditCardList$/);
  assert.equal(finCall.body.Header.apiKey, 'APIKEY-1');
  assert.equal(finCall.body.Header.userKey, 'UK-1');
  const bad = await post(port, '/api/fin/hack', {});
  assert.equal(bad.status, 404);
  server.close();
});

test('POST /api/fin/subList maps to the subscription list endpoint', async () => {
  const { server, calls, port } = await startServer({ finResult: { REC: { subscriptions: [] } } });
  const { json } = await post(port, '/api/fin/subList', { userKey: 'UK-1', fields: {} });
  assert.equal(json.ok, true);
  assert.match(calls.find((c) => c.url).body.Header.apiName, /^inquireSubscriptionList$/);
  server.close();
});
