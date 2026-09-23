import { initTopbar, finCall, recRows, won } from '/common.js';

initTopbar('/subscriptions.html');

let services = [];
let cards = [];
const $ = (id) => document.getElementById(id);
const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtYmd = (s) => (s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s || '');
const CYCLE_KO = { MONTHLY: '월간', DAILY: '일간' };
const STATUS_KO = { ACTIVE: '활성', PAUSED: '일시정지', CANCELED: '해지됨' };

async function init() {
  $('sub-start').value = localYmd(new Date());
  $('new-sub-btn').addEventListener('click', openModal);
  $('sub-close').addEventListener('click', () => $('sub-overlay').classList.add('hidden'));
  $('sub-overlay').addEventListener('click', (e) => { if (e.target.id === 'sub-overlay') $('sub-overlay').classList.add('hidden'); });
  $('sub-cycle').addEventListener('change', () => {
    $('sub-payday-row').classList.toggle('hidden', $('sub-cycle').value !== 'MONTHLY');
  });
  $('sub-form').addEventListener('submit', onCreate);
  await loadList();
  loadServices();
  loadCards();
}

function showError(message) {
  const box = $('sub-error');
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}

async function loadList() {
  showError('');
  let payload;
  try {
    payload = await finCall('subList', {});
  } catch (err) {
    showError('정기결제 목록 조회 실패: ' + (err?.message || err));
    return;
  }
  const rec = payload.REC || {};
  const subs = recRows(payload);
  $('sub-summary').textContent = `활성 ${rec.activeCount ?? 0}건 · 월 합계 ${won(rec.totalMonthlyAmount ?? 0)}`;
  const body = $('sub-body');
  body.innerHTML = '';
  for (const sub of subs) body.appendChild(renderRow(sub));
  $('sub-wrap').classList.toggle('hidden', subs.length === 0);
  $('sub-empty').classList.toggle('hidden', subs.length !== 0);
}

function renderRow(sub) {
  const tr = document.createElement('tr');
  const status = STATUS_KO[sub.status] || sub.status || '';
  const cells = [
    sub.subscriptionName ?? sub.subscriptionId,
    won(sub.paymentAmount),
    CYCLE_KO[sub.billingCycle] || sub.billingCycle || '',
    fmtYmd(sub.nextPaymentDate),
    status,
  ];
  cells.forEach((text, i) => {
    const td = document.createElement('td');
    td.textContent = text;
    if (i === 1) td.className = 'money';
    tr.appendChild(td);
  });

  const actions = document.createElement('td');
  if (sub.status !== 'CANCELED') {
    const historyBtn = button('이력', 'btn', () => toggleHistory(tr, sub));
    actions.appendChild(historyBtn);
    const toggleBtn = button(sub.status === 'PAUSED' ? '재개' : '일시정지', 'btn', async () => {
      await act(toggleBtn, () => finCall('subToggle', {
        subscriptionId: String(sub.subscriptionId),
        action: sub.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
      }));
    });
    actions.appendChild(toggleBtn);
    const cancelBtn = button('해지', 'btn danger', async () => {
      if (!window.confirm(`"${sub.subscriptionName}" 구독을 해지할까요?`)) return;
      await act(cancelBtn, () => finCall('subCancel', { subscriptionId: String(sub.subscriptionId) }));
    });
    actions.appendChild(cancelBtn);
  }
  actions.style.display = 'flex';
  actions.style.gap = '6px';
  tr.appendChild(actions);
  return tr;
}

function button(label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

async function act(btn, fn) {
  btn.disabled = true;
  try {
    await fn();
    await loadList();
  } catch (err) {
    showError('처리 실패: ' + (err?.message || err));
    btn.disabled = false;
  }
}

async function toggleHistory(tr, sub) {
  const next = tr.nextElementSibling;
  if (next?.classList.contains('detail-row')) { next.remove(); return; }
  let rows = [];
  try {
    rows = recRows(await finCall('subHistory', { subscriptionId: String(sub.subscriptionId) }));
  } catch (err) {
    showError('이력 조회 실패: ' + (err?.message || err));
    return;
  }
  const detail = document.createElement('tr');
  detail.className = 'detail-row';
  const td = document.createElement('td');
  td.colSpan = 6;
  if (!rows.length) {
    td.textContent = '결제 이력이 없습니다.';
    td.style.color = 'var(--mut)';
  } else {
    for (const h of rows) {
      const line = document.createElement('div');
      const ok = h.resultCode === 'H0000';
      line.textContent = `${fmtYmd(h.paymentDate)} · ${won(h.paymentAmount)} · ${ok ? '성공' : `실패(${h.resultMessage ?? h.resultCode})`}`;
      if (!ok) line.style.color = 'var(--req)';
      td.appendChild(line);
    }
  }
  detail.appendChild(td);
  tr.after(detail);
}

async function loadServices() {
  try {
    services = recRows(await finCall('subServices', {}));
    const select = $('sub-service');
    select.innerHTML = '';
    for (const s of services) {
      const opt = document.createElement('option');
      opt.value = s.serviceId;
      opt.textContent = `${s.serviceName} ${s.planName ?? ''} — 월 ${won(s.monthlyPrice)}`;
      select.appendChild(opt);
    }
  } catch (err) {
    showError('구독 서비스 목록 조회 실패: ' + (err?.message || err));
  }
}

async function loadCards() {
  try {
    cards = recRows(await finCall('cards', {}));
    const select = $('sub-card');
    select.innerHTML = '';
    for (const card of cards) {
      const opt = document.createElement('option');
      opt.value = card.cardNo;
      opt.textContent = `${card.cardName} (${String(card.cardNo).slice(0, 4)}-****)`;
      select.appendChild(opt);
    }
  } catch (err) {
    showError('내 카드 목록 조회 실패: ' + (err?.message || err));
  }
}

function openModal() {
  $('sub-result').classList.add('hidden');
  $('sub-submit').disabled = false;
  $('sub-overlay').classList.remove('hidden');
}

async function onCreate(e) {
  e.preventDefault();
  const resultBox = $('sub-result');
  const btn = $('sub-submit');
  btn.disabled = true;
  btn.textContent = '등록 중...';
  try {
    const monthly = $('sub-cycle').value === 'MONTHLY';
    const fields = {
      cardNo: String($('sub-card').value),
      serviceId: String($('sub-service').value),
      billingCycle: $('sub-cycle').value,
      startDate: $('sub-start').value.replaceAll('-', ''),
    };
    if (monthly) fields.paymentDay = String($('sub-payday').value);
    await finCall('subCreate', fields);
    resultBox.className = 'note';
    resultBox.textContent = '구독이 등록되었습니다.';
    resultBox.classList.remove('hidden');
    await loadList();
  } catch (err) {
    resultBox.className = 'note err';
    resultBox.textContent = '등록 실패: ' + (err?.message || err);
    resultBox.classList.remove('hidden');
    btn.disabled = false;
  } finally {
    btn.textContent = '등록';
    if (btn.disabled) setTimeout(() => { btn.disabled = false; }, 800);
  }
}

init();
