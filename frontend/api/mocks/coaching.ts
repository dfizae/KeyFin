import { ApiError } from "@/api/error";
import type { ChatHistoryDto, ChatMessageDto, ChatReplyDto } from "@/features/coaching/model";
import { getKSTParts } from "@/lib/date";

/**
 * GET·POST /coaching/chat 목 (배포 서버 Swagger · 백엔드 CoachingChatService, 2026-09-22).
 * 서버처럼 세션을 하나 들고 있다: 첫 질문에 세션이 열려 24시간 뒤 만료 시각이 잡히고, 그 뒤 질문·답변이 이력에 쌓인다.
 * 답변은 질문에 예측·위험·다음 달·괜찮 이 들어가면 COACHING(engine 집계), 아니면 CHAT(llm) 이다.
 * 답을 못 하는 경우도 본다: 주식·코인 투자·로또 는 out_of_scope 안내 문구(template).
 */
const SESSION_HOURS = 24;
const UNAVAILABLE_MESSAGE = "코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요.";

type MockSession = { messages: ChatMessageDto[]; expiresAt: string };

let session: MockSession | null = null;
let unavailable = false;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function kstLocalDateTime(date: Date): string {
  const p = getKSTParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

function answer(message: string): ChatReplyDto {
  const id = `mock-${Date.now()}`;
  if (/주식|코인 투자|로또/.test(message)) {
    return {
      reply: "투자 종목 추천은 제가 도울 수 없는 영역이에요. 대신 이번 달 소비나 다음 달 결제 준비는 같이 볼 수 있어요.",
      kind: "CHAT",
      status: "out_of_scope",
      source: "template",
      fallbackReason: null,
      answerId: id,
    };
  }
  if (/예측|위험|다음 달|괜찮/.test(message)) {
    return {
      reply: "다음 달 25일 카드 대금 214,000원이 나가는데 결제 계좌 잔액이 180,000원이라 34,000원이 모자라요. 20일까지 준비 이체를 잡아 두면 안전해요.",
      kind: "COACHING",
      status: "answered",
      source: "engine",
      fallbackReason: null,
      answerId: id,
    };
  }
  return {
    reply: "이번 달 외식 봉투는 120,000원 중 84,500원을 썼어요. 남은 35,500원으로 열흘을 보내려면 하루 3,500원 정도예요.",
    kind: "CHAT",
    status: "answered",
    source: "llm",
    fallbackReason: null,
    answerId: id,
  };
}

export function chatHistoryMock(): ChatHistoryDto {
  if (unavailable) throw new ApiError(503, "AI_001", UNAVAILABLE_MESSAGE);
  if (session === null) return { messages: [], expiresAt: null };
  return { messages: session.messages.map((m) => ({ ...m })), expiresAt: session.expiresAt };
}

export function sendChatMock(message: string): ChatReplyDto {
  if (unavailable) throw new ApiError(503, "AI_001", UNAVAILABLE_MESSAGE);
  if (message.trim() === "" || message.length > 2000) throw new ApiError(400, "COMMON_001", "입력값이 올바르지 않습니다.");
  if (session === null) {
    session = { messages: [], expiresAt: kstLocalDateTime(new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000)) };
  }
  const reply = answer(message);
  session.messages.push({ role: "user", content: message }, { role: "assistant", content: reply.reply });
  return reply;
}

/** 코칭 서버가 자리를 비운 상황(503 AI_001)을 흉내 낸다 */
export function setCoachingUnavailableMock(next: boolean): void {
  unavailable = next;
}

export function resetCoachingMocks(): void {
  session = null;
  unavailable = false;
}
