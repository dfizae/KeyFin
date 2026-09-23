import { initTopbar, finCall, recRows, won } from '/common.js';

initTopbar('/history.html');

let cards = [];
const $ = (id) => document.getElementById(id);
// toISOString은 UTC라서 KST 자정~09시에 날짜가 하루 밀린다 — 로컬 기준으로 포맷
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function init() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);
  $('start-date').value = ymd(monthAgo);
  $('end-date').value = ymd(today);
  $('load-btn').addEventListener('click', loadHistory);
  try {
    cards = recRows(await finCall('cards', {}));
  } catch (err) {
    showError('내 카드 목록 조회 실패: ' + (err?.message || err));
    return;
  }
  const select = $('card-select');
  for (const card of cards) {
    const opt = document.createElement('option');
    opt.value = card.cardNo;
    opt.textContent = `${card.cardName} (${String(card.cardNo).slice(0, 4)}-****)`;
    select.appendChild(opt);
  }
  if (cards.length) loadHistory();
  else showError('보유한 카드가 없습니다. 관리자 콘솔에서 카드를 먼저 발급하세요.');
}

function showError(message) {
  const box = $('history-error');
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}

function card() {
  return cards.find((c) => String(c.cardNo) === $('card-select').value);
}

async function loadHistory() {
  showError('');
  const c = card();
  if (!c) return;
  let rows;
  try {
    const payload = await finCall('transactions', {
      cardNo: String(c.cardNo),
      cvc: String(c.cvc),
      startDate: $('start-date').value.replaceAll('-', ''),
      endDate: $('end-date').value.replaceAll('-', ''),
    });
    rows = recRows(payload);
  } catch (err) {
    showError('내역 조회 실패: ' + (err?.message || err));
    return;
  }
  const body = $('history-body');
  body.innerHTML = '';
  for (const tx of rows) {
    body.appendChild(renderRow(tx, c));
  }
  $('history-wrap').classList.toggle('hidden', rows.length === 0);
  $('history-empty').classList.toggle('hidden', rows.length !== 0);
}

const fmtDate = (d, t) => {
  const date = d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
  const time = t ? ` ${t.slice(0, 2)}:${t.slice(2, 4)}` : '';
  return date + time;
};

function renderRow(tx, c) {
  const canceled = /취소|CANCEL/i.test(`${tx.transactionStatus ?? ''}${tx.status ?? ''}${tx.cardStatus ?? ''}`);
  const tr = document.createElement('tr');
  const cells = [
    tx.transactionUniqueNo ?? '',
    fmtDate(tx.transactionDate, tx.transactionTime),
    tx.merchantName ?? tx.merchantId ?? '',
    tx.categoryName ?? '',
    won(tx.transactionBalance ?? tx.paymentBalance ?? ''),
    canceled ? '취소됨' : (tx.transactionStatus ?? tx.status ?? '승인'),
  ];
  cells.forEach((text, i) => {
    const td = document.createElement('td');
    td.textContent = text;
    if (i === 4) td.className = canceled ? 'money canceled' : 'money';
    tr.appendChild(td);
  });
  const actionTd = document.createElement('td');
  if (!canceled) {
    const btn = document.createElement('button');
    btn.className = 'btn danger';
    btn.type = 'button';
    btn.textContent = '결제 취소';
    btn.addEventListener('click', () => onCancel(tx, c, btn));
    actionTd.appendChild(btn);
  }
  tr.appendChild(actionTd);
  return tr;
}

async function onCancel(tx, c, btn) {
  if (!window.confirm(`${tx.merchantName ?? ''} ${won(tx.transactionBalance ?? tx.paymentBalance)} 결제를 취소할까요?`)) return;
  btn.disabled = true;
  try {
    // 스펙엔 Long이지만 실제 API는 문자열만 받는다 — 문자열로 전송
    await finCall('cancel', { cardNo: String(c.cardNo), cvc: String(c.cvc), transactionUniqueNo: String(tx.transactionUniqueNo) });
    await loadHistory();
  } catch (err) {
    showError('결제 취소 실패: ' + (err?.message || err));
    btn.disabled = false;
  }
}

init();
