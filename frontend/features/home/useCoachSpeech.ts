import * as React from "react";

import type { CoachSpeech } from "@/features/notification/store";

/** 말풍선을 펼쳐 두는 시간. 2~3초 보여 준 뒤 대화 아이콘으로 접는다 (사용자 요청 2026-09-23) */
export const COACH_SPEECH_OPEN_MS = 2500;

export type CoachSpeechView = {
  /** 말풍선에 보일 문장. 펼쳐 있는 동안은 펼친 순간의 문장을 유지한다 */
  text: string;
  /** true 면 말풍선, false 면 접힌 대화 아이콘 */
  open: boolean;
  /** 아직 한 번도 직접 열어 보지 않았으면 아이콘에 빨간 점을 단다 */
  unread: boolean;
  onPressIcon: () => void;
  onPressBubble: () => void;
};

/**
 * 코치 고양이 말풍선의 펼침·접힘 (사용자 요청 2026-09-23).
 * 처음 보는 문장이 생기면 말풍선을 COACH_SPEECH_OPEN_MS 동안 펼쳤다가 대화 아이콘으로 접는다. 아이콘을 누르면 다시 펼치고 읽음으로 친다.
 * 말풍선을 누르면 바로 접는다. paused(방 대기 화면·안내·보드·딱지 창이 떠 있는 동안)에는 아무것도 보이지 않고, 끝나면 못 보여 준 새 문장을 그때 펼친다.
 * onRead 는 사용자가 문장을 직접 열어 봤을 때 부른다 — 알림 문장은 이때 치워지고, 상황 문장은 남아 아이콘으로 계속 볼 수 있다.
 */
export function useCoachSpeech(message: CoachSpeech | null, paused: boolean, onRead: (key: string) => void): CoachSpeechView | null {
  const [opened, setOpened] = React.useState<CoachSpeech | null>(null);
  const [seenKeys, setSeenKeys] = React.useState<readonly string[]>([]);
  const [readKeys, setReadKeys] = React.useState<readonly string[]>([]);

  // 펼친 채로 가려지면(안내·창·방 대기 화면) 접어 두고, 아직 안 읽은 말이면 가림이 끝난 뒤 처음부터 다시 펼친다 — 못 본 채 지나가지 않게
  if (paused && opened !== null) {
    const hidden = opened.key;
    setOpened(null);
    if (!readKeys.includes(hidden)) setSeenKeys(seenKeys.filter((key) => key !== hidden));
  }

  // 처음 보는 문장은 한 번 저절로 펼친다. 다른 말풍선이 펼쳐 있는 동안에는 그것이 접힌 뒤로 미룬다 (렌더 중 이전 값 비교 패턴)
  if (message !== null && !paused && opened === null && !seenKeys.includes(message.key)) {
    setSeenKeys([...seenKeys, message.key]);
    setOpened(message);
  }

  // 펼친 말풍선은 정해진 시간 뒤 접는다 — 시계라는 외부 시스템에 맞추는 일이라 effect 로 둔다
  const openedKey = opened?.key ?? null;
  React.useEffect(() => {
    if (openedKey === null) return;
    const timer = setTimeout(() => setOpened((current) => (current?.key === openedKey ? null : current)), COACH_SPEECH_OPEN_MS);
    return () => clearTimeout(timer);
  }, [openedKey]);

  const read = (key: string) => {
    if (!readKeys.includes(key)) setReadKeys([...readKeys, key]);
    onRead(key);
  };

  if (paused || (message === null && opened === null)) return null;
  const shown = opened ?? message;
  if (shown === null) return null;

  return {
    text: shown.text,
    open: opened !== null,
    unread: message !== null && !readKeys.includes(message.key),
    onPressIcon: () => {
      if (message === null) return;
      read(message.key);
      setOpened(message);
    },
    onPressBubble: () => {
      if (opened !== null) read(opened.key);
      setOpened(null);
    },
  };
}
