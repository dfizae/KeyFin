import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFinBody } from './finHeader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// 금융망 중복 등록 사고(같은 가맹점 2건)의 잔재를 이름+카테고리 기준으로 걸러낸다 — 먼저 등록된 ID를 사용
const MERCHANT_SQL =
  'SELECT MIN(m.fin_merchant_id) AS fin_merchant_id, m.name, s.name AS subcategory_name '
  + 'FROM merchants m JOIN subcategories s ON m.subcategory_id = s.id '
  + 'GROUP BY m.name, s.name ORDER BY s.name, m.name';

export function createApp({ finBaseUrl, finApiKey, db, fetchImpl = fetch }) {
  const FIN = String(finBaseUrl || '').replace(/\/$/, '');
  if (!FIN) throw new Error('finBaseUrl(FINANCE_API_BASE_URL)이 필요합니다.');
  if (!finApiKey) throw new Error('finApiKey(FINANCE_API_KEY)가 필요합니다.');
  // 이 앱이 중계를 허용하는 금융망 API 화이트리스트
  const FIN_ACTIONS = {
    cards: `${FIN}/edu/creditCard/inquireSignUpCreditCardList`,
    pay: `${FIN}/edu/creditCard/createCreditCardTransaction`,
    transactions: `${FIN}/edu/creditCard/inquireCreditCardTransactionList`,
    cancel: `${FIN}/edu/creditCard/deleteTransaction`,
    subServices: `${FIN}/edu/creditCard/inquireSubscriptionService`,
    subList: `${FIN}/edu/creditCard/inquireSubscriptionList`,
    subCreate: `${FIN}/edu/creditCard/subscriptionPayment`,
    subCancel: `${FIN}/edu/creditCard/cancelSubscription`,
    subToggle: `${FIN}/edu/creditCard/pauseSubscription`,
    subHistory: `${FIN}/edu/creditCard/inquireSubscriptionHistory`,
  };
  const MEMBER_SEARCH = `${FIN}/member/search`;

  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  async function callFin(url, fields, userKey) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFinBody({ url, fields, apiKey: finApiKey, userKey })),
    });
    return { ok: true, data: await res.json() };
  }

  const fail = (res, status, message) => res.status(status).json({ ok: false, message });

  app.get('/healthz', (req, res) => res.json({ status: 'UP' }));

  app.post('/api/login', async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      if (!userId) return fail(res, 400, '이메일을 입력하세요.');
      const result = await callFin(MEMBER_SEARCH, { userId });
      const data = result.ok ? result.data : null;
      if (data?.userKey) {
        return res.json({ ok: true, userId, userKey: data.userKey, userName: data.userName || userId.split('@')[0] });
      }
      const message = data?.responseMessage || result.error?.responseMessage || '로그인에 실패했습니다.';
      res.json({ ok: false, message });
    } catch (err) {
      fail(res, 500, String(err?.message || err));
    }
  });

  let merchantCache = null; // ponytail: 프로세스 캐시 — 가맹점 추가가 잦아지면 TTL 부여
  app.get('/api/merchants', async (req, res) => {
    try {
      if (!merchantCache) {
        const [rows] = await db.query(MERCHANT_SQL);
        merchantCache = rows.map((r) => ({
          finMerchantId: r.fin_merchant_id,
          name: r.name,
          subcategoryName: r.subcategory_name,
        }));
      }
      res.json(merchantCache);
    } catch (err) {
      fail(res, 500, 'DB 조회 실패: ' + String(err?.message || err));
    }
  });

  app.post('/api/fin/:action', async (req, res) => {
    const url = FIN_ACTIONS[req.params.action];
    if (!url) return fail(res, 404, '허용되지 않은 요청입니다.');
    try {
      const { userKey, fields } = req.body || {};
      res.json(await callFin(url, fields || {}, userKey));
    } catch (err) {
      fail(res, 500, String(err?.message || err));
    }
  });

  return app;
}
