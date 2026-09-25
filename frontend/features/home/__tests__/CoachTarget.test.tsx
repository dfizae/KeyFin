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
    "복돈이 가마솥 순대국 강남본점 10,000원을 분류해 주세요.",
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

  it.each([false, true])("접힌 아이콘은 미확정 결제 유무와 관계없이 말풍선만 펼친다 (미확정: %s)", async (hasPending) => {
    const speech = makeSpeech({ open: false, unread: false });
    const onPressCat = jest.fn();
    await render(<CoachTarget width={327} speech={speech} hasPending={hasPending} onPress={onPressCat} />);

    expect(screen.queryByText(speech.text)).toBeNull();
    expect(screen.queryByRole("button", { name: "코치 말풍선 닫기" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: hasPending ? "코치가 할 말 보기, 새 메시지" : "코치가 할 말 보기" }));
    expect(speech.onPressIcon).toHaveBeenCalledTimes(1);
    expect(speech.onClose).not.toHaveBeenCalled();
    expect(onPressCat).not.toHaveBeenCalled();
  });

  it.each([false, true])("표시할 메시지가 없으면 이동용 아이콘을 만들지 않는다 (미확정: %s)", async (hasPending) => {
    await render(<CoachTarget width={327} speech={null} hasPending={hasPending} onPress={jest.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "코치" })).toBeTruthy();
  });

  // Jest는 네이티브 레이아웃을 계산하지 않으므로 높이 제한과 스크롤 설정의 계약을 검사한다.
  it.each([
    { width: 327, bubbleLimit: 240, contentLimit: 222 },
    { width: 163.5, bubbleLimit: 230, contentLimit: 212 },
  ])("폭 $width에서 닫기 영역을 포함한 높이 상한과 본문 스크롤을 유지한다", async ({ width, bubbleLimit, contentLimit }) => {
    await render(<CoachTarget width={width} speech={makeSpeech()} onPress={jest.fn()} />);

    expect(screen.getByTestId("coach-speech-bubble")).toHaveStyle({ maxHeight: bubbleLimit });
    const content = screen.getByTestId("coach-speech-content");
    expect(content).toHaveStyle({ flexGrow: 0, flexShrink: 1, alignSelf: "center", maxHeight: contentLimit });
    expect(content.props.showsVerticalScrollIndicator).toBe(true);
    expect(content.props.bounces).toBe(false);
  });

  it("실제 표시 영역의 오른쪽 여백에 맞춰 본문과 X의 가용 폭을 제한한다", async () => {
    await render(<CoachTarget width={379} viewport={{ width: 280, height: 680 }} speech={makeSpeech()} onPress={jest.fn()} />);

    const placement = screen.getByTestId("coach-speech-placement");
    const rightAtStrollEnd = placement.props.style.left + placement.props.style.width + 12 * (379 / 327) - (379 - 280) / 2;
    expect(rightAtStrollEnd).toBeCloseTo(272); // 화면 오른쪽 8pt를 남긴다.
    const content = screen.getByTestId("coach-speech-content");
    expect(content.props.style.maxWidth + 44 + 4 + 24 + 2).toBeCloseTo(placement.props.style.width);
  });
});
