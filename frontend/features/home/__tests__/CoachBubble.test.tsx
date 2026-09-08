import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { pendingTransactionsMock } from "@/api/mocks/transaction";
import { COACH_COLLAPSE_MS, CoachBubble } from "@/features/home/components/CoachBubble";
import { toTransaction } from "@/features/transaction/model";

const transaction = toTransaction(pendingTransactionsMock().items[0]);

describe("CoachBubble", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("30초 무응답이면 말풍선만 접히고, 코치를 탭하면 다시 편다", async () => {
    await render(<CoachBubble width={327} transaction={transaction} isPending={false} errorMessage={null} onConfirm={jest.fn()} onOther={jest.fn()} />);
    expect(screen.getByText("『메가커피 역삼점 4,500원』 카페 맞나냥?")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(COACH_COLLAPSE_MS);
    });
    expect(screen.queryByText("『메가커피 역삼점 4,500원』 카페 맞나냥?")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "코치, 확인할 결제 있음" }));
    expect(screen.getByText("『메가커피 역삼점 4,500원』 카페 맞나냥?")).toBeTruthy();
  });

  it("질문이 없으면 코치만 보이고 버튼이 없다", async () => {
    await render(<CoachBubble width={327} transaction={null} isPending={false} errorMessage={null} onConfirm={jest.fn()} onOther={jest.fn()} />);
    expect(screen.getByRole("button", { name: "코치" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다른 카테고리" })).toBeNull();
  });

  it("저장 중에는 버튼을 비활성화하고 오류 문구를 보여준다", async () => {
    await render(
      <CoachBubble width={327} transaction={transaction} isPending errorMessage="분류를 저장하지 못했어요." onConfirm={jest.fn()} onOther={jest.fn()} />
    );
    expect(screen.getByText("분류를 저장하지 못했어요.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "카페 확정" }).props.accessibilityState).toMatchObject({ disabled: true });
  });
});
