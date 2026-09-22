import { ApiError } from "@/api/error";
import { chatHistoryMock, resetCoachingMocks, sendChatMock, setCoachingUnavailableMock } from "@/api/mocks/coaching";
import { chatErrorMessage, isCoachUnavailable } from "@/features/coaching/errors";
import {
  appendChatTurn,
  CHAT_MESSAGE_MAX_LENGTH,
  EMPTY_CHAT_HISTORY,
  toChatHistory,
  toChatReply,
  validateChatMessage,
  type ChatReplyDto,
} from "@/features/coaching/model";
import { ContractMismatchError } from "@/lib/contract";

const replyDto: ChatReplyDto = {
  reply: "이번 달 외식 봉투는 120,000원 중 84,500원을 썼어요.",
  kind: "CHAT",
  status: "answered",
  source: "llm",
  fallbackReason: null,
  answerId: "ans-1",
};

describe("coaching model", () => {
  it("답변 DTO 를 화면 모델로 바꾸고 answered 만 실제 답변으로 본다", () => {
    expect(toChatReply(replyDto)).toEqual({ ...replyDto, isAnswered: true });
    const declined = toChatReply({ ...replyDto, kind: "COACHING", status: "needs_data", source: "template" });
    expect(declined.isAnswered).toBe(false);
    expect(declined.kind).toBe("COACHING");
  });

  it("모르는 kind·status·source 는 UNKNOWN 으로 흡수하고, reply 가 없으면 계약 불일치다", () => {
    const reply = toChatReply({ ...replyDto, kind: "RANT", status: "thinking", source: "oracle" });
    expect([reply.kind, reply.status, reply.source]).toEqual(["UNKNOWN", "UNKNOWN", "UNKNOWN"]);
    expect(() => toChatReply({ ...replyDto, reply: undefined as unknown as string })).toThrow(ContractMismatchError);
  });

  it("이력은 세션이 없으면 빈 목록·hasSession false, 있으면 KST 만료 시각을 지킨다", () => {
    expect(toChatHistory({ messages: [], expiresAt: null })).toEqual(EMPTY_CHAT_HISTORY);
    const history = toChatHistory({
      messages: [
        { role: "user", content: "외식 얼마 남았어?" },
        { role: "assistant", content: "35,500원 남았어요." },
        { role: "system", content: "…" },
      ],
      expiresAt: "2026-09-23T10:00:00",
    });
    expect(history.hasSession).toBe(true);
    expect(history.messages.map((m) => m.role)).toEqual(["user", "assistant", "UNKNOWN"]);
    expect(() => toChatHistory({ messages: [], expiresAt: "2026-09-23T10:00:00+09:00" })).toThrow(ContractMismatchError);
  });

  it("질문은 공백을 잘라 1자 이상 2000자 이하일 때만 보낸다", () => {
    expect(validateChatMessage("  외식 얼마 남았어?  ")).toEqual({ ok: true, message: "외식 얼마 남았어?" });
    expect(validateChatMessage("   ")).toEqual({ ok: false, reason: "empty" });
    expect(validateChatMessage("가".repeat(CHAT_MESSAGE_MAX_LENGTH + 1))).toEqual({ ok: false, reason: "too_long" });
  });

  it("답변을 받으면 이력 끝에 질문·답변 한 턴을 붙이고 세션이 있는 것으로 본다", () => {
    const next = appendChatTurn(EMPTY_CHAT_HISTORY, "외식 얼마 남았어?", toChatReply(replyDto));
    expect(next.hasSession).toBe(true);
    expect(next.messages).toEqual([
      { role: "user", content: "외식 얼마 남았어?" },
      { role: "assistant", content: replyDto.reply },
    ]);
  });
});

describe("coaching errors", () => {
  it("AI_001 은 코치 부재 문구, 400 은 길이 안내, 그 밖은 서버 문구를 쓴다", () => {
    const unavailable = new ApiError(503, "AI_001", "코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요.");
    expect(isCoachUnavailable(unavailable)).toBe(true);
    expect(chatErrorMessage(unavailable)).toBe("코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요.");
    expect(chatErrorMessage(new ApiError(400, "COMMON_001", "입력값이 올바르지 않습니다."))).toBe(
      "질문은 1자 이상 2000자 이하로 적어 주세요."
    );
    expect(chatErrorMessage(new ApiError(500, "COMMON_006", "서버 내부 오류"))).toBe("서버 내부 오류");
    expect(chatErrorMessage(new Error("boom"))).toBe("답변을 받지 못했어요. 다시 시도해 주세요.");
  });
});

describe("coaching mocks", () => {
  beforeEach(() => resetCoachingMocks());

  it("첫 질문에 세션이 열리고 질문·답변이 이력에 쌓인다", () => {
    expect(chatHistoryMock()).toEqual({ messages: [], expiresAt: null });
    const reply = sendChatMock("다음 달 괜찮아?");
    expect(reply.kind).toBe("COACHING");
    const history = chatHistoryMock();
    expect(history.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(history.messages).toEqual([
      { role: "user", content: "다음 달 괜찮아?" },
      { role: "assistant", content: reply.reply },
    ]);
  });

  it("금융 밖 질문은 out_of_scope 안내이고, 코칭 서버가 없으면 503 AI_001 이다", () => {
    expect(sendChatMock("주식 뭐 살까?").status).toBe("out_of_scope");
    setCoachingUnavailableMock(true);
    expect(() => sendChatMock("외식 얼마 남았어?")).toThrow(ApiError);
    expect(() => chatHistoryMock()).toThrow(ApiError);
  });
});
