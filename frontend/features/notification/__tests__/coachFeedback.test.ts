import { announceCoachFeedback, COACH_FEEDBACK_MAX_ATTEMPTS, resetCoachFeedbackRequests } from "@/features/notification/coachFeedback";
import type { CoachFeedback } from "@/features/notification/model";

function deps(responses: (CoachFeedback | Error)[]) {
  const queue = [...responses];
  return {
    fetch: jest.fn(async () => {
      const next = queue.shift() ?? { status: "PENDING" as const, text: null };
      if (next instanceof Error) throw next;
      return next;
    }),
    wait: jest.fn(async () => undefined),
    announce: jest.fn(),
  };
}

describe("announceCoachFeedback — 예산 알림 코치 피드백을 홈 말풍선으로 (-184)", () => {
  afterEach(() => resetCoachFeedbackRequests());

  it("PENDING 이면 다시 묻고 READY 가 되면 문장을 한 번 말한다", async () => {
    const d = deps([{ status: "PENDING", text: null }, { status: "READY", text: "외식을 멈추는 편이 좋다냥." }]);

    await announceCoachFeedback(41, d);

    expect(d.fetch).toHaveBeenCalledTimes(2);
    expect(d.wait).toHaveBeenCalledTimes(1);
    expect(d.announce).toHaveBeenCalledWith("외식을 멈추는 편이 좋다냥.");
  });

  it("FAILED·NONE·오류·시간 초과면 말하지 않는다", async () => {
    for (const response of [{ status: "FAILED" as const, text: null }, { status: "NONE" as const, text: null }, new Error("offline")]) {
      const d = deps([response]);
      await announceCoachFeedback(42, d);
      expect(d.announce).not.toHaveBeenCalled();
      resetCoachFeedbackRequests();
    }

    const pending = deps([]);
    await announceCoachFeedback(43, pending);
    expect(pending.fetch).toHaveBeenCalledTimes(COACH_FEEDBACK_MAX_ATTEMPTS);
    expect(pending.announce).not.toHaveBeenCalled();
  });

  it("같은 알림은 푸시·알림함에서 겹쳐 불러도 한 번만 묻는다", async () => {
    const d = deps([{ status: "READY", text: "한 번만 말한다냥." }]);

    await announceCoachFeedback(44, d);
    await announceCoachFeedback(44, d);

    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.announce).toHaveBeenCalledTimes(1);
  });
});
