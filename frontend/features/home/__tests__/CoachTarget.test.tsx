import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { CoachTarget } from "@/features/home/components/CoachTarget";
import type { CoachSpeechView } from "@/features/home/useCoachSpeech";

function makeSpeech(overrides: Partial<CoachSpeechView> = {}): CoachSpeechView {
  return {
    text: "이번 달 예산을 확인해 주세요.",
    open: true,
    unread: true,
    onPressIcon: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

describe("CoachTarget", () => {
  it("고양이 자리의 탭 영역을 누르면 알린다", async () => {
    const onPress = jest.fn();
    await render(<CoachTarget width={327} onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "코치" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    "이번 달 예산을 확인해 주세요.",
    "카드별 결제 내역과 이번 달 예산을 차근차근 확인해 주세요. ".repeat(30),
  ])("본문을 눌러도 접히지 않고 별도 닫기 버튼으로 접는다", async (text) => {
    const speech = makeSpeech({ text });
    const onPressCat = jest.fn();
    await render(<CoachTarget width={327} speech={speech} onPress={onPressCat} />);

    await fireEvent.press(screen.getByText(text));
    expect(speech.onClose).not.toHaveBeenCalled();
    expect(onPressCat).not.toHaveBeenCalled();

    const close = screen.getByRole("button", { name: "코치 말풍선 닫기" });
    expect(close).toHaveStyle({ width: 44, height: 44, flexShrink: 0 });
    await fireEvent.press(close);
    expect(speech.onClose).toHaveBeenCalledTimes(1);
    expect(onPressCat).not.toHaveBeenCalled();
  });

  it("접힌 아이콘을 누르면 말풍선을 다시 여는 콜백을 부른다", async () => {
    const speech = makeSpeech({ open: false, unread: false });
    await render(<CoachTarget width={327} speech={speech} onPress={jest.fn()} />);

    expect(screen.queryByText(speech.text)).toBeNull();
    expect(screen.queryByRole("button", { name: "코치 말풍선 닫기" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "코치가 할 말 보기" }));
    expect(speech.onPressIcon).toHaveBeenCalledTimes(1);
    expect(speech.onClose).not.toHaveBeenCalled();
  });

  // Jest는 네이티브 레이아웃을 계산하지 않으므로 높이 제한과 스크롤 설정의 계약을 검사한다.
  it.each([
    { width: 327, bubbleLimit: 240, contentLimit: 178 },
    { width: 109, bubbleLimit: 161, contentLimit: 99 },
  ])("폭 $width에서 닫기 영역을 포함한 높이 상한과 본문 스크롤을 유지한다", async ({ width, bubbleLimit, contentLimit }) => {
    await render(<CoachTarget width={width} speech={makeSpeech()} onPress={jest.fn()} />);

    expect(screen.getByTestId("coach-speech-bubble")).toHaveStyle({ maxHeight: bubbleLimit });
    const content = screen.getByTestId("coach-speech-content");
    expect(content).toHaveStyle({ flexGrow: 0, maxHeight: contentLimit });
    expect(content.props.showsVerticalScrollIndicator).toBe(true);
    expect(content.props.bounces).toBe(false);
  });
});
