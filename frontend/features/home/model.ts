/**
 * 홈 코치 고양이 말풍선 (사용자 요청 2026-09-23). 예산을 넘겨 방에 압류 딱지가 붙었거나 가구에 부스러기가 생겼을 때
 * 고양이가 지금 무슨 일이 일어났는지 한 줄로 알려 준다. 둘 다 없으면 말하지 않는다(null).
 * 딱지가 더 큰 사건(전체 예산 초과)이라 딱지가 있으면 딱지만 말한다.
 */
export type CoachSituation = {
  /** 설치된 가구에 붙은 압류 딱지 수 (GET /room stickers.count) */
  stickerCount: number;
  /** 오늘 딱지를 하나 더 뗄 수 있는지 (stickers.removableToday) */
  removableToday: boolean;
  /** 지금 방에 그려진 부스러기. 봉투 이름과 가구 이름 */
  penalties: readonly { envelopeName: string; furnitureName: string }[];
};

export function coachSituationMessage({ stickerCount, removableToday, penalties }: CoachSituation): string | null {
  if (stickerCount > 0) {
    const removal = removableToday ? "딱지를 누르면 오늘 하나를 뗄 수 있어요." : "딱지는 하루에 하나씩 뗄 수 있어요. 내일 다시 떼 봐요.";
    return `예산을 모두 넘겨서 가구에 압류 딱지가 ${stickerCount}개 붙었어요. ${removal}`;
  }
  if (penalties.length === 0) return null;
  const envelopes = joinWithAnd(unique(penalties.map((penalty) => penalty.envelopeName)));
  const furnitures = joinWithAnd(unique(penalties.map((penalty) => withoutVariant(penalty.furnitureName))));
  return `${envelopes} 예산을 넘겨서 ${furnitures}${subjectParticle(furnitures)} 어질러졌어요. 봉투에 잔액이 다시 생기면 치워져요.`;
}

/** "식탁 (오리지널)" 처럼 색상 변형이 붙은 가구 이름에서 괄호 부분을 뗀다 — 말로 할 때는 가구 종류만 부른다 */
function withoutVariant(name: string): string {
  return name.replace(/\s*\([^)]*\)$/, "");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** "식탁과 커피 테이블" — 앞말 받침에 따라 과/와 */
function joinWithAnd(names: readonly string[]): string {
  return names.reduce((joined, name) => (joined === "" ? name : `${joined}${hasFinalConsonant(joined) ? "과" : "와"} ${name}`), "");
}

function subjectParticle(word: string): string {
  return hasFinalConsonant(word) ? "이" : "가";
}

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const FINAL_CONSONANT_COUNT = 28;

/** 마지막 글자가 받침 있는 한글 음절인지. 한글이 아니면 받침 없음으로 본다 */
function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  if (Number.isNaN(code) || code < HANGUL_START || code > HANGUL_END) return false;
  return (code - HANGUL_START) % FINAL_CONSONANT_COUNT !== 0;
}
