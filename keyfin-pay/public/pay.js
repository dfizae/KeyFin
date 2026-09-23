import { initTopbar, finCall, recRows, won } from '/common.js';

initTopbar('/pay.html');

let merchants = [];
let cards = [];
let activeCategory = '전체';
let selectedMerchant = null;

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    merchants = await (await fetch('/api/merchants')).json();
    if (!Array.isArray(merchants)) throw new Error(merchants?.message || '가맹점 로드 실패');
  } catch (err) {
    alert('가맹점 목록 로드 실패: ' + (err?.message || err));
    return;
  }
  renderTabs();
  renderGrid();
  $('search').addEventListener('input', renderGrid);
  $('pay-close').addEventListener('click', closeModal);
  $('pay-overlay').addEventListener('click', (e) => { if (e.target.id === 'pay-overlay') closeModal(); });
  $('pay-form').addEventListener('submit', onPay);
  loadCards();
}

async function loadCards() {
  try {
    cards = recRows(await finCall('cards', {}));
    const select = $('pay-card');
    select.innerHTML = '';
    for (const card of cards) {
      const opt = document.createElement('option');
      opt.value = card.cardNo;
      opt.textContent = `${card.cardName} (${String(card.cardNo).slice(0, 4)}-****)`;
      select.appendChild(opt);
    }
    if (!cards.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '보유한 카드가 없습니다';
      select.appendChild(opt);
    }
  } catch (err) {
    alert('내 카드 목록 조회 실패: ' + (err?.message || err));
  }
}

function categories() {
  return ['전체', ...new Set(merchants.map((m) => m.subcategoryName))];
}

function renderTabs() {
  const tabs = $('cat-tabs');
  tabs.innerHTML = '';
  for (const cat of categories()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = cat;
    btn.classList.toggle('on', cat === activeCategory);
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderTabs();
      renderGrid();
    });
    tabs.appendChild(btn);
  }
}

function renderGrid() {
  const q = $('search').value.trim().toLowerCase();
  const list = merchants.filter((m) =>
    (activeCategory === '전체' || m.subcategoryName === activeCategory)
    && (!q || m.name.toLowerCase().includes(q) || m.subcategoryName.toLowerCase().includes(q)));
  const grid = $('merchant-grid');
  grid.innerHTML = '';
  for (const m of list) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'm-card';
    const name = document.createElement('b');
    name.textContent = m.name;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = m.subcategoryName;
    card.append(name, chip);
    card.addEventListener('click', () => openModal(m));
    grid.appendChild(card);
  }
  $('grid-empty').classList.toggle('hidden', list.length > 0);
}

function openModal(merchant) {
  selectedMerchant = merchant;
  $('pay-merchant-name').textContent = merchant.name;
  $('pay-merchant-cat').textContent = merchant.subcategoryName;
  $('pay-amount').value = '';
  $('pay-result').classList.add('hidden');
  $('pay-submit').disabled = false;
  $('pay-overlay').classList.remove('hidden');
  $('pay-amount').focus();
}

function closeModal() {
  $('pay-overlay').classList.add('hidden');
  selectedMerchant = null;
}

async function onPay(e) {
  e.preventDefault();
  const cardNo = $('pay-card').value;
  const card = cards.find((c) => String(c.cardNo) === cardNo);
  const resultBox = $('pay-result');
  if (!card) {
    resultBox.textContent = '결제할 카드를 선택하세요.';
    resultBox.className = 'note err';
    resultBox.classList.remove('hidden');
    return;
  }
  const btn = $('pay-submit');
  btn.disabled = true;
  btn.textContent = '결제 중...';
  try {
    // 스펙엔 Long이지만 실제 API는 문자열만 받는다(숫자로 보내면 Q1001) — 전 필드 문자열로 전송
    const payload = await finCall('pay', {
      cardNo: String(card.cardNo),
      cvc: String(card.cvc),
      merchantId: String(selectedMerchant.finMerchantId),
      paymentBalance: String($('pay-amount').value),
    });
    const rec = payload.REC || {};
    resultBox.className = 'note';
    resultBox.textContent = `결제 완료 — ${rec.merchantName || selectedMerchant.name} ${won(rec.paymentBalance ?? $('pay-amount').value)} (거래번호 ${rec.transactionUniqueNo ?? '-'})`;
    resultBox.classList.remove('hidden');
  } catch (err) {
    resultBox.className = 'note err';
    resultBox.textContent = '결제 실패: ' + (err?.message || err);
    resultBox.classList.remove('hidden');
    btn.disabled = false;
  } finally {
    btn.textContent = '결제하기';
    if (btn.disabled) setTimeout(() => { btn.disabled = false; }, 800); // 성공 직후 연타 방지
  }
}

init();
