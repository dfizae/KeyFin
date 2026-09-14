import * as React from "react";

import { ApiError } from "@/api/error";
import { acknowledgeCoachingNotification, getCoachingAnswer, getCoachingRecord, getCoachingSession, sendCoachingMessage, startCoachingSession } from "@/features/coaching/api";
import type { CoachingAnswer } from "@/features/coaching/model";

export type ChatMessage = { readonly id: string; readonly role: "user" | "assistant";
  readonly text: string; readonly answer?: CoachingAnswer };
type Attempt = { readonly key: string; readonly question: string };
let sequence = 0;
/** Only a deduplication key; authentication and owner identity come from the backend JWT. */
function requestKey(): string { sequence += 1; return `chat-${Date.now()}-${sequence}-${Math.random().toString(36).slice(2)}`; }

export function useCoachingChat(initialSession?: string, coachingId?: string, notificationId?: string) {
  const [messages, setMessages] = React.useState<readonly ChatMessage[]>([]);
  const [busy, setBusy] = React.useState(initialSession !== undefined || coachingId !== undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [retryPending, setRetryPending] = React.useState(false);
  const session = React.useRef<string | undefined>(initialSession);
  const startKey = React.useRef(requestKey());
  const pending = React.useRef<Attempt | null>(null);
  const inFlight = React.useRef(false);
  const active = React.useRef(true);

  React.useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = React.useCallback(() => {
    if (initialSession === undefined && coachingId !== undefined) {
      return getCoachingRecord(coachingId).then((answer) => {
        if (!active.current) return;
        setMessages([{ id: answer.id, role: "assistant", text: answer.text, answer }]);
        setError(null);
        // Opening an unread notification is acknowledged only after its original coaching loads.
        if (notificationId !== undefined) return acknowledgeCoachingNotification(notificationId, `ack-${startKey.current}`).catch(() => {
          if (active.current) setError("코칭은 불러왔지만 읽음 상태를 저장하지 못했어요. 다시 시도해 주세요.");
        });
      }).catch((failure: unknown) => {
        if (active.current) setError(failure instanceof ApiError ? failure.message : "코칭을 불러오지 못했어요.");
      }).finally(() => { if (active.current) setBusy(false); });
    }
    if (initialSession === undefined) return;
    return getCoachingSession(initialSession).then(async (saved) => {
      if (!active.current) return;
      if (saved.id !== initialSession) throw new Error("Session response does not match the requested resource");
      const restored: readonly ChatMessage[] = saved.messages.map((message, index) => ({
        id: `${saved.id}-${index}`, role: message.role, text: message.content,
      }));
      setMessages(restored);
      // References are owner-scoped resources, never reconstructed from assistant text.
      // Keep each stored message visible even when a single source response cannot be loaded.
      const details = await Promise.allSettled(saved.messages.map(async (message, index): Promise<ChatMessage> => {
        const reference = message.response;
        if (message.role !== "assistant" || reference == null) return restored[index];
        const answer = reference.kind === "chat" ? await getCoachingAnswer(reference.id) : await getCoachingRecord(reference.id);
        if (answer.id !== reference.id || answer.kind !== (reference.kind === "chat" ? "chat" : "coaching")) {
          throw new Error("Saved response reference does not match its source");
        }
        return { ...restored[index], text: answer.text, answer };
      }));
      if (!active.current) return;
      setMessages(details.map((result, index) => result.status === "fulfilled" ? result.value : restored[index]));
      setError(details.some((result) => result.status === "rejected")
        ? "일부 답변의 근거를 불러오지 못해 저장된 본문을 표시했어요. 다시 시도해 주세요." : null);
    }).catch((failure: unknown) => {
      if (active.current) setError(failure instanceof ApiError ? failure.message : "대화 응답 형식을 확인할 수 없어요.");
    }).finally(() => { if (active.current) setBusy(false); });
  }, [initialSession, coachingId, notificationId]);
  React.useEffect(() => { void load(); }, [load]);

  const send = async (question: string): Promise<boolean> => {
    if (inFlight.current || busy || question.trim().length === 0 || question.length > 2000) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const attempt = pending.current ?? { key: requestKey(), question: question.trim() };
    if (pending.current === null) {
      pending.current = attempt;
      setRetryPending(true);
      setMessages((current) => [...current, { id: attempt.key, role: "user", text: attempt.question }]);
    }
    try {
      // Retrying creation and a failed turn uses the same keys, even after an uncertain timeout.
      session.current ??= (await startCoachingSession(startKey.current, coachingId)).id;
      const answer = await sendCoachingMessage(session.current, attempt.question, attempt.key);
      pending.current = null;
      if (active.current) {
        setRetryPending(false);
        setMessages((current) => [...current, { id: answer.id, role: "assistant", text: answer.text, answer }]);
      }
      return true;
    } catch (failure: unknown) {
      if (active.current) setError(failure instanceof ApiError ? failure.message : "답변 형식을 확인할 수 없어요. 다시 시도해 주세요.");
      return false;
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };

  const changeQuestion = () => { pending.current = null; setRetryPending(false); setError(null); };
  const retry = () => {
    if (pending.current) return send(pending.current.question);
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    return Promise.resolve(load()).finally(() => { inFlight.current = false; });
  };
  return { messages, busy, error, send, retry,
    retryPending, changeQuestion };
}
