import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { COACH_PLACEHOLDER, CoachBubble, cleanupLinkLabel } from "@/features/home/components/CoachBubble";

describe("CoachBubble", () => {
  it("코치를 탭하면 임시 말풍선 '?' 이 열리고 다시 탭하면 닫힌다", async () => {
    await render(<CoachBubble width={327} />);
    expect(screen.queryByText(COACH_PLACEHOLDER)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "코치" }));
    expect(screen.getByText(COACH_PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "코치" }));
    expect(screen.queryByText(COACH_PLACEHOLDER)).toBeNull();
  });

  it("미확정 결제가 있으면 정리 링크를 함께 보여주고 누르면 알린다", async () => {
    const onCleanup = jest.fn();
    await render(<CoachBubble width={327} pendingCount={2} onCleanup={onCleanup} />);
    await fireEvent.press(screen.getByRole("button", { name: "코치" }));

    await fireEvent.press(screen.getByRole("link", { name: cleanupLinkLabel(2) }));
    expect(onCleanup).toHaveBeenCalledTimes(1);
  });
});
