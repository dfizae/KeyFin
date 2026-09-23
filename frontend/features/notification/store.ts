import { create } from "zustand";

/**
 * 앱을 보고 있는 동안 온 알림을 홈의 코치 고양이가 말풍선으로 옮겨 말하기 위한 한 줄 (사용자 요청 2026-09-23).
 * 푸시 구독(레이아웃)과 홈 화면이 서로 다른 곳이라 전역 클라이언트 상태로 둔다. 서버 데이터가 아니라 "방금 온 알림 문장" 하나만 담는다.
 * key 는 같은 문장이 다시 와도 새 알림으로 알아보게 하는 순번이다.
 */
export type CoachSpeech = { key: string; text: string };

type CoachSpeechState = {
  latest: CoachSpeech | null;
  announce: (text: string) => void;
  /** 사용자가 읽은 알림 문장을 치운다. 그 사이 새 알림이 왔으면 새 것은 남긴다 */
  clear: (key: string) => void;
};

let sequence = 0;

export const useCoachSpeechStore = create<CoachSpeechState>((set) => ({
  latest: null,
  announce: (text) => {
    sequence += 1;
    set({ latest: { key: `push-${sequence}`, text } });
  },
  clear: (key) => set((state) => (state.latest?.key === key ? { latest: null } : state)),
}));
