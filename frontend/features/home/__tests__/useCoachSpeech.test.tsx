import { act, renderHook } from "@testing-library/react-native";

import { COACH_SPEECH_OPEN_MS, useCoachSpeech } from "@/features/home/useCoachSpeech";

const feedback = { key: "push-1", text: "외식 예산을 넘었다냥. 이번 주기에는 외식을 멈추는 편이 좋다냥." };

describe("useCoachSpeech — 말풍선 펼침·접힘", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("저절로 펼친 말풍선은 정해진 시간 뒤 접히고, 아이콘으로 연 말풍선은 누를 때까지 남는다 (-184)", async () => {
    const onRead = jest.fn();
    const hook = await renderHook(() => useCoachSpeech(feedback, false, onRead));
    expect(hook.result.current?.open).toBe(true);

    await act(async () => { jest.advanceTimersByTime(COACH_SPEECH_OPEN_MS); });
    expect(hook.result.current?.open).toBe(false);

    await act(async () => { hook.result.current?.onPressIcon(); });
    await act(async () => { jest.advanceTimersByTime(COACH_SPEECH_OPEN_MS * 4); });
    expect(hook.result.current?.open).toBe(true);
    expect(onRead).toHaveBeenCalledWith("push-1");

    await act(async () => { hook.result.current?.onPressBubble(); });
    expect(hook.result.current?.open).toBe(false);
  });
});
