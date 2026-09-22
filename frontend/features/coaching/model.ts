import { ContractMismatchError } from "@/lib/contract";
import { KST_LOCAL_DATE_TIME } from "@/lib/date";

/**
 * 코칭 대화 계약 (배포 서버 Swagger `/api/v1/coaching/chat`, 백엔드 develop CoachingChatController, 2026-09-22 대조. FR-AI-04 · PAGE-31).
 * 세션은 서버가 사용자당 하나 관리하고(24시간·질문 20회) 만료되면 새 세션으로 이어진다 — 앱은 세션 id 를 모른다.
 * kind·status·source 는 코칭 서버 값을 그대로 넘겨주므로 모르는 값은 UNKNOWN 으로 흡수한다 (규칙 90).
 */

/** 서버 @Size(max = 2000). 비면 400 COMMON_001 */
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

/** CHAT = 금융 개념·소비 조회·안내, COACHING = 예측·위험 코칭 */
export const CHAT_KINDS = ["CHAT", "COACHING"] as const;
export type ChatKind = (typeof CHAT_KINDS)[number] | "UNKNOWN";

/**
 * 코칭 서버 상태 그대로. answered 외에는 답을 못 한 이유다 —
 * needs_source(근거 자료 없음) · needs_data(개인 자료 부족) · needs_clarification(지원하지 않는 기간·필터) · out_of_scope(금융 외) · unavailable(모델 실패, fallbackReason 참고).
 * COACHING 은 서버가 항상 answered 로 준다.
 */
export const CHAT_STATUSES = ["answered", "needs_source", "needs_data", "needs_clarification", "out_of_scope", "unavailable"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number] | "UNKNOWN";

/** llm = 모델 문장, template = 안내 문구, engine = 확정 원장 집계 */
export const CHAT_SOURCES = ["llm", "template", "engine"] as const;
export type ChatSource = (typeof CHAT_SOURCES)[number] | "UNKNOWN";

export const CHAT_ROLES = ["user", "assistant"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number] | "UNKNOWN";

export type ChatRequestDto = { message: string };

export type ChatReplyDto = {
  reply: string;
  kind: string;
  status: string | null;
  source: string | null;
  fallbackReason: string | null;
  answerId: string | null;
};

export type ChatMessageDto = { role: string; content: string };

export type ChatHistoryDto = {
  messages: ChatMessageDto[];
  /** "2026-09-23T10:00:00" (KST). 세션이 없거나 만료됐으면 null */
  expiresAt: string | null;
};

export type ChatReply = {
  reply: string;
  kind: ChatKind;
  status: ChatStatus;
  source: ChatSource;
  fallbackReason: string | null;
  answerId: string | null;
  /** 실제 답변인지. 아니면 status 가 못 한 이유다 */
  isAnswered: boolean;
};

export type ChatMessage = { role: ChatRole; content: string };

export type ChatHistory = {
  messages: ChatMessage[];
  expiresAt: string | null;
  /** 살아 있는 세션이 있어 이어서 묻는 중인지 */
  hasSession: boolean;
};

function toUnion<T extends string>(values: readonly T[], raw: string | null | undefined): T | "UNKNOWN" {
  return typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as T) : "UNKNOWN";
}

export function toChatReply(dto: ChatReplyDto): ChatReply {
  if (typeof dto.reply !== "string") throw new ContractMismatchError("reply");
  const status = toUnion(CHAT_STATUSES, dto.status);
  return {
    reply: dto.reply,
    kind: toUnion(CHAT_KINDS, dto.kind),
    status,
    source: toUnion(CHAT_SOURCES, dto.source),
    fallbackReason: dto.fallbackReason ?? null,
    answerId: dto.answerId ?? null,
    isAnswered: status === "answered",
  };
}

export function toChatMessage(dto: ChatMessageDto): ChatMessage {
  if (typeof dto.content !== "string") throw new ContractMismatchError("messages.content");
  return { role: toUnion(CHAT_ROLES, dto.role), content: dto.content };
}

export function toChatHistory(dto: ChatHistoryDto): ChatHistory {
  if (dto.expiresAt !== null && dto.expiresAt !== undefined && !KST_LOCAL_DATE_TIME.test(dto.expiresAt)) {
    throw new ContractMismatchError("expiresAt");
  }
  const expiresAt = dto.expiresAt ?? null;
  return { messages: (dto.messages ?? []).map(toChatMessage), expiresAt, hasSession: expiresAt !== null };
}

export const EMPTY_CHAT_HISTORY: ChatHistory = { messages: [], expiresAt: null, hasSession: false };

export type ChatMessageValidation = { ok: true; message: string } | { ok: false; reason: "empty" | "too_long" };

/** 보내기 전에 서버 규칙(공백만이면 400, 2000자 초과 400)을 미리 걸러 헛된 요청을 막는다. 앞뒤 공백은 잘라 보낸다 */
export function validateChatMessage(raw: string): ChatMessageValidation {
  const message = raw.trim();
  if (message === "") return { ok: false, reason: "empty" };
  if (message.length > CHAT_MESSAGE_MAX_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, message };
}

/**
 * 답변을 받은 뒤 이력 캐시에 질문·답변 한 턴을 붙인다 — 이력을 다시 받지 않아도 화면이 이어진다.
 * 세션 만료 시각은 서버만 알아서(만료 뒤 첫 질문이면 새 세션) 그대로 두고, 세션이 없던 상태였으면 있는 것으로 본다.
 */
export function appendChatTurn(history: ChatHistory, question: string, reply: ChatReply): ChatHistory {
  return {
    ...history,
    messages: [...history.messages, { role: "user", content: question }, { role: "assistant", content: reply.reply }],
    hasSession: true,
  };
}
