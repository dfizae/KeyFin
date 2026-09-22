import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { CoachTarget } from "@/features/home/components/CoachTarget";

describe("CoachTarget", () => {
  it("고양이 자리의 탭 영역을 누르면 알린다", async () => {
    const onPress = jest.fn();
    await render(<CoachTarget width={327} onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "코치" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
