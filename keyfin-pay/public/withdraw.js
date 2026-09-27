import { $, confirmDialog, esc, finCall, initTopbar, num, recRows, toast, won } from './common.js';

initTopbar('/withdraw.html');

let accounts = [];

function note(el, message, tone) {
  el.textContent = message;
  el.className = `note${tone ? ` note-${tone}` : ''}`;
}

async function loadAccounts(keepNo) {
  try {
    accounts = recRows(await finCall('accounts', {}));
    $('err').classList.add('hidden');
  } catch (err) {
    note($('err'), `계좌를 불러오지 못했어요. ${err.message}`, 'neg');
    $('accounts').innerHTML = '';
    return;
  }
  if (!accounts.length) {
    $('accounts').innerHTML = '<p class="form-msg">출금할 수 있는 계좌가 없어요.</p>';
    return;
  }
  const checked = keepNo ?? accounts[0].accountNo;
  $('accounts').innerHTML = accounts.map((a) => `<label>
      <input type="radio" name="acct" value="${esc(a.accountNo)}"${a.accountNo === checked ? ' checked' : ''} />
      <span class="dot"></span>
      <span class="t">${esc(a.bankName)}<small>${esc(a.accountNo)}</small></span>
      <span class="p">${esc(won(a.accountBalance))}</span>
    </label>`).join('');
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fNote = $('f-note');
  const accountNo = document.querySelector('input[name="acct"]:checked')?.value;
  const account = accounts.find((a) => a.accountNo === accountNo);
  const amount = num($('amount').value);
  if (!account) return note(fNote, '출금할 계좌를 골라 주세요.', 'neg');
  if (!Number.isInteger(amount) || amount <= 0) return note(fNote, '출금 금액을 1원 이상 정수로 입력해 주세요.', 'neg');
  const memo = $('memo').value.trim() || '현금 출금';

  const ok = await confirmDialog({
    title: '출금할까요?',
    body: `<b>${esc(account.bankName)} ${esc(account.accountNo)}</b>에서 <b>${esc(won(amount))}</b>을 출금해요. 되돌릴 수 없어요.`,
    okLabel: '출금하기',
  });
  if (!ok) return;

  $('submit').disabled = true;
  try {
    await finCall('withdraw', { accountNo, transactionBalance: String(amount), transactionSummary: memo });
    note(fNote, `${won(amount)}을 출금했어요. KeyFin 앱에는 잠시 뒤 거래가 반영돼요.`, 'pos');
    toast('출금했어요');
    $('amount').value = '';
    await loadAccounts(accountNo);
  } catch (err) {
    // 잔액 부족(A1014)·한도 초과(A1016·A1017)는 금융망 문구 그대로 보여 준다
    note(fNote, `출금하지 못했어요. ${err.message}`, 'neg');
  } finally {
    $('submit').disabled = false;
  }
});

loadAccounts();
