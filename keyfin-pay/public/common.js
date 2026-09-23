export function getUser() {
  try { return JSON.parse(localStorage.getItem('keyfinPayUser')); } catch { return null; }
}

export function requireUser() {
  const user = getUser();
  if (!user?.userKey) { location.href = '/'; throw new Error('not logged in'); }
  return user;
}

export function logout() {
  localStorage.removeItem('keyfinPayUser');
  location.href = '/';
}

export async function finCall(action, fields) {
  const { userKey } = requireUser();
  const res = await fetch(`/api/fin/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userKey, fields }),
  });
  const result = await res.json();
  const payload = result.ok ? result.data : result.error || {};
  const code = payload?.responseCode ?? payload?.Header?.responseCode;
  if (!result.ok || (code && code !== 'H0000')) {
    throw new Error(payload?.responseMessage || result.message || '요청에 실패했습니다.');
  }
  return payload;
}

export function recRows(payload) {
  const rec = payload?.REC;
  if (Array.isArray(rec)) return rec;
  if (rec && typeof rec === 'object') {
    const list = Object.values(rec).find(Array.isArray);
    if (list) return list;
  }
  return [];
}

export const won = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') + '원' : String(v);
};

export function initTopbar(active) {
  const user = requireUser();
  document.querySelector(`.topbar nav a[href="${active}"]`)?.classList.add('on');
  document.getElementById('who-name').textContent = `${user.userName} (${user.userId})`;
  document.getElementById('logout-btn').addEventListener('click', logout);
}
