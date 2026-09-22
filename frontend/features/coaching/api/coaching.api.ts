import { api, isMocked } from "@/api/client";
import { chatHistoryMock, sendChatMock } from "@/api/mocks/coaching";
import { withMockLatency } from "@/api/mocks/latency";
import {
  toChatHistory,
  toChatReply,
  type ChatHistory,
  type ChatHistoryDto,
  type ChatReply,
  type ChatReplyDto,
  type ChatRequestDto,
} from "@/features/coaching/model";

/**
 * GET /coaching/chat — 현재 세션의 대화 이력 (FR-AI-04, PAGE-31). 세션이 없거나 만료됐으면 messages 빈 배열·expiresAt null.
 * 오류: 503 AI_001(코칭 서버 응답 없음).
 */
export async function getChatHistory(signal?: AbortSignal): Promise<ChatHistory> {
  if (isMocked("coaching")) return toChatHistory(await withMockLatency(chatHistoryMock(), signal));
  const { data } = await api.get<ChatHistoryDto>("/coaching/chat", { signal });
  return toChatHistory(data);
}

/**
 * POST /coaching/chat — 코치에게 질문 한 턴. 세션은 서버가 잇는다(24시간·20회, 만료되면 새 세션).
 * 오류: 400 COMMON_001(비었거나 2000자 초과) · 503 AI_001. 돈이 움직이지 않으므로 화면에서 다시 시도해도 된다.
 */
export async function sendChatMessage(message: string): Promise<ChatReply> {
  if (isMocked("coaching")) return toChatReply(await withMockLatency(sendChatMock(message)));
  const body: ChatRequestDto = { message };
  const { data } = await api.post<ChatReplyDto>("/coaching/chat", body);
  return toChatReply(data);
}
