import { useRouter } from "expo-router";
import { ChartLine, MessageCircle, SendHorizontal, WifiOff } from "lucide-react-native";
import * as React from "react";
import { FlatList, Image, Pressable, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Screen, ScreenFlatList } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useChatHistory, useSendChatMessage } from "@/features/coaching/api/queries";
import { CoachingNumericTable } from "@/features/coaching/components/CoachingNumericTable";
import { CoachingSpendingTable } from "@/features/coaching/components/CoachingSpendingTable";
import { chatErrorMessage, isCoachRejected } from "@/features/coaching/errors";
import { CHAT_MESSAGE_MAX_LENGTH, validateChatMessage, type ChatMessage } from "@/features/coaching/model";
import { COACH_CAT } from "@/features/room/assets";
import { flattenPending, usePendingTransactions } from "@/features/transaction/api/queries";
import { formatDateTime, parseKSTLocalDateTime } from "@/lib/date";
import { typography } from "@/lib/theme";
import { cn } from "@/lib/utils";

const HOME_ROUTE = "/";
const CLEANUP_ROUTE = "/transaction/pending";
const CHART_ROUTE = "/coaching/chart";
export const CHART_LINK_LABEL = "예산 예측 차트 보기";
export const COACH_TITLE = "코치";
export const CHAT_INPUT_LABEL = "코치에게 물어보기";
export const SEND_LABEL = "보내기";
/** 답을 기다리는 동안 코치 자리에 두는 말풍선 */
export const THINKING_LABEL = "코치가 생각하고 있어요";
/** NativeWind className 은 RN Image 에 적용되지 않아 크기만 style 로 준다 */
const AVATAR_STYLE = { width: 36, height: 36 } as const;
/** 내 질문 말풍선은 화면 폭의 85% 를 넘지 않는다(비율 값이라 style 로 준다) */
const BUBBLE_MAX_STYLE = { maxWidth: "85%" } as const;
/**
 * 말풍선 글자는 `text-label`(15/22) 보다 4 작은 11/16 — 폰에서 한 말풍선이 너무 길게 늘어져 보여 줄였다(2026-09-22 사용자 요청).
 * 토큰에 없는 크기라 CoachRow 처럼 label 토큰에서 빼서 style 로 준다. DESIGN.md 의 최소 12 아래라 대화 말풍선에만 쓴다.
 */
const CHAT_TEXT_SHRINK = 4;
const CHAT_TEXT_STYLE = {
  fontSize: typography.label.fontSize - CHAT_TEXT_SHRINK,
  lineHeight: typography.label.lineHeight - CHAT_TEXT_SHRINK - 2,
} as const;

export function cleanupLinkLabel(pendingCount: number, pendingMore = false): string {
  return `미확정 결제 ${pendingCount}건${pendingMore ? "+" : ""} 정리`;
}

/** 목록 한 줄. 서버 이력과, 보내는 중인 질문·기다리는 답변을 같은 모양으로 그린다 */
type ChatRow =
  | { key: string; kind: "message"; message: ChatMessage }
  | { key: "thinking"; kind: "thinking" }
  /** retryable=false 는 코칭 서버가 그 질문을 거절한 것(AI_003) — 같은 질문을 다시 보내지 않고 입력창에서 다르게 묻는다 */
  | { key: "error"; kind: "error"; message: string; retryable: boolean };

/**
 * PAGE-31 코칭 대화 (FR-AI-04, P1). 홈의 코치 고양이를 누르면 들어온다(2026-09-22 사용자 요청 — 그 전까지는 임시 "?" 말풍선).
 * GET /coaching/chat 이력을 그대로 보여 주고, 질문은 POST 한 턴씩이다. 세션은 서버가 잇는다(24시간·20회).
 * 코치 말투·문구는 서버가 만들고 앱은 만들지 않는다(docs/frontend-spec.md 비즈니스 규칙) — 빈 화면 안내는 앱 문구, 답변은 전부 서버 문구다.
 * 답을 기다리는 동안 보낸 질문을 먼저 보여 주고, 실패하면 입력값을 살려 둔 채 그 자리에 다시 시도를 둔다(돈이 움직이지 않아 다시 보내도 된다).
 * 홈 코치에 있던 '미확정 결제 n건 정리' 링크(2026-09-13 사용자 결정)는 여기 상단으로 옮겼다.
 * Pencil 미대조(시안 없음). 내 질문만 오른쪽 `bg-primary` 말풍선이고, 코치 답변은 말풍선 없이 고양이 얼굴 아래 바탕에 그대로 적는다
 * (2026-09-22 사용자 요청 — 처음엔 얼굴 옆 bg-card 말풍선이었는데 폰 폭에서 글이 세로로 길게 늘어졌다).
 * 소비 조회 집계(rows·totalKrw)와 위험·가정 표 데이터(numericRows)는 답변 아래 표로 보여 준다. GET 이력에는 둘 다 없어 재조회 후에는 본문·차트만 남는다.
 * 답변에 예산 예측 차트가 딸리면(chartId) 글 아래 '차트 보기' 버튼이 PAGE-31B 로 간다 — 차트 HTML 은 한 페이지라 말풍선에 넣지 않는다.
 */
function CoachingChatScreen() {
  const router = useRouter();
  const history = useChatHistory();
  const send = useSendChatMessage();
  const pending = usePendingTransactions();
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<FlatList<ChatRow>>(null);

  const pendingCount = flattenPending(pending.data).length;
  const validation = validateChatMessage(draft);
  const canSend = validation.ok && !send.isPending;

  const submit = () => {
    if (!validation.ok || send.isPending) return;
    send.mutate(validation.message, { onSuccess: () => setDraft("") });
  };
  const retry = () => {
    if (send.variables === undefined || send.isPending) return;
    send.mutate(send.variables);
  };

  const rows = React.useMemo<ChatRow[]>(() => {
    const messages = history.data?.messages ?? [];
    const list: ChatRow[] = messages.map((message, index) => ({ key: `m-${index}`, kind: "message", message }));
    // 보낸 질문은 답이 올 때까지(성공 시 캐시에 붙는다) 여기서만 보인다. 실패하면 질문 아래에 다시 시도를 둔다.
    if (send.isPending || send.isError) {
      list.push({
        key: "q-pending",
        kind: "message",
        message: { role: "user", content: send.variables ?? "", chartId: null, rows: [], totalKrw: null, numericRows: null },
      });
      list.push(
        send.isPending
          ? { key: "thinking", kind: "thinking" }
          : { key: "error", kind: "error", message: chatErrorMessage(send.error), retryable: !isCoachRejected(send.error) }
      );
    }
    return list;
  }, [history.data, send.isPending, send.isError, send.variables, send.error]);

  const expiresAt = history.data?.expiresAt ?? null;

  return (
    <Screen>
      <ScreenHeader title={COACH_TITLE} onBack={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))} />
      <KeyboardAvoidingView className="flex-1">
        {history.isPending ? (
          <ChatSkeleton />
        ) : history.isError ? (
          <View className="flex-1 justify-center pb-20">
            <EmptyState
              icon={WifiOff}
              title="대화를 불러오지 못했어요"
              description={chatErrorMessage(history.error)}
              action={{ label: "다시 시도", onPress: () => history.refetch(), disabled: history.isFetching }}
            />
          </View>
        ) : (
          <ScreenFlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerClassName="gap-3 px-6 pb-4"
            renderItem={({ item }) => (
              <ChatRowView row={item} onRetry={retry} onOpenChart={(chartId) => router.push(`${CHART_ROUTE}/${chartId}`)} />
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View className="gap-3 pb-1">
                {pendingCount > 0 ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={cleanupLinkLabel(pendingCount, pending.hasNextPage)}
                    hitSlop={6}
                    onPress={() => router.push(CLEANUP_ROUTE)}
                    className="self-start rounded-lg bg-accent px-3.5 py-2 active:opacity-80"
                  >
                    <Text className="text-label text-primary">{cleanupLinkLabel(pendingCount, pending.hasNextPage)}</Text>
                  </Pressable>
                ) : null}
                {expiresAt !== null ? (
                  <Text className="text-caption text-muted-foreground">
                    이 대화는 {formatDateTime(parseKSTLocalDateTime(expiresAt))}까지 이어져요
                  </Text>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon={MessageCircle}
                title="코치에게 물어보세요"
                description="이번 달 소비, 다음 달 결제 준비, 궁금한 금융 용어를 물을 수 있어요."
              />
            }
          />
        )}
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          disabled={!canSend}
          sending={send.isPending}
          tooLong={!validation.ok && validation.reason === "too_long"}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

type ChatRowViewProps = { row: ChatRow; onRetry: () => void; onOpenChart: (chartId: string) => void };

function ChatRowView({ row, onRetry, onOpenChart }: ChatRowViewProps) {
  if (row.kind === "thinking") {
    return (
      <CoachReply>
        <Text className="text-label text-muted-foreground" style={CHAT_TEXT_STYLE} accessibilityLiveRegion="polite">
          {THINKING_LABEL}
        </Text>
      </CoachReply>
    );
  }
  if (row.kind === "error") {
    return (
      <CoachReply>
        <Text className="text-label text-destructive" style={CHAT_TEXT_STYLE} accessibilityLiveRegion="polite">
          {row.message}
        </Text>
        {row.retryable ? (
          <Pressable accessibilityRole="button" accessibilityLabel="다시 시도" hitSlop={6} onPress={onRetry} className="self-start">
            <Text className="text-label text-primary" style={CHAT_TEXT_STYLE}>
              다시 시도
            </Text>
          </Pressable>
        ) : null}
      </CoachReply>
    );
  }
  const { message } = row;
  const { chartId } = message;
  if (message.role === "user") {
    return (
      <View className="self-end rounded-2xl bg-primary px-4 py-3" style={BUBBLE_MAX_STYLE} accessibilityRole="text">
        <Text className="text-label text-primary-foreground" style={CHAT_TEXT_STYLE}>
          {message.content}
        </Text>
      </View>
    );
  }
  return (
    <CoachReply>
      <Text className="text-label text-foreground" style={CHAT_TEXT_STYLE}>
        {message.content}
      </Text>
      <CoachingSpendingTable rows={message.rows} totalKrw={message.totalKrw} />
      <CoachingNumericTable numericRows={message.numericRows} />
      {chartId === null ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHART_LINK_LABEL}
          hitSlop={6}
          onPress={() => onOpenChart(chartId)}
          className="flex-row items-center gap-1.5 self-start rounded-lg bg-accent px-3.5 py-2 active:opacity-80"
        >
          <Icon as={ChartLine} size={16} className="text-primary" />
          <Text className="text-label text-primary" style={CHAT_TEXT_STYLE}>
            {CHART_LINK_LABEL}
          </Text>
        </Pressable>
      )}
    </CoachReply>
  );
}

/** 코치(고양이) 답변 — 고양이 얼굴 아래에 말풍선 카드 없이 바탕에 그대로 적는다(2026-09-22 사용자 요청). 카드가 없으니 폭 제한도 없다 */
function CoachReply({ children }: { children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Image source={COACH_CAT} style={AVATAR_STYLE} resizeMode="contain" accessible={false} />
      <View className="gap-2" accessibilityRole="text">
        {children}
      </View>
    </View>
  );
}

type ChatComposerProps = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  sending: boolean;
  tooLong: boolean;
};

function ChatComposer({ value, onChange, onSubmit, disabled, sending, tooLong }: ChatComposerProps) {
  return (
    <View className="gap-1 border-t border-border bg-background px-6 pb-4 pt-3">
      <View className="flex-row items-end gap-2">
        <Input
          className="max-h-32 flex-1"
          value={value}
          onChangeText={onChange}
          placeholder="이번 달 외식 얼마 남았어?"
          accessibilityLabel={CHAT_INPUT_LABEL}
          multiline
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          editable={!sending}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSubmit}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={SEND_LABEL}
          accessibilityState={{ disabled, busy: sending }}
          disabled={disabled}
          onPress={onSubmit}
          hitSlop={8}
          className={cn("h-touch w-touch items-center justify-center rounded-full bg-primary active:opacity-80", disabled && "opacity-50")}
        >
          <Icon as={SendHorizontal} size={20} className="text-primary-foreground" />
        </Pressable>
      </View>
      {tooLong ? <Text className="text-caption text-destructive">질문은 {CHAT_MESSAGE_MAX_LENGTH}자까지 보낼 수 있어요.</Text> : null}
    </View>
  );
}

function ChatSkeleton() {
  return (
    <View className="flex-1 gap-3 px-6" accessibilityLabel="대화를 불러오는 중">
      <Skeleton className="h-16 w-3/4 self-start rounded-lg" />
      <Skeleton className="h-10 w-1/2 self-end rounded-2xl" />
      <Skeleton className="h-20 w-4/5 self-start rounded-lg" />
    </View>
  );
}

export { CoachingChatScreen };
