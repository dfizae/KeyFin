import { ExternalLink } from "lucide-react-native";
import { Linking, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ANSWER_STATUS_LABELS } from "@/features/coaching/model";
import type { ChatMessage } from "@/features/coaching/useCoachingChat";

export function CoachingMessage({ message, onLinkError }: {
  readonly message: ChatMessage; readonly onLinkError: () => void;
}) {
  const answer = message.answer;
  if (message.role === "user") {
    return <View className="ml-6 rounded-lg bg-primary p-4">
      <Text className="text-caption text-primary-foreground">나의 질문</Text>
      <Text selectable className="text-body text-primary-foreground">{message.text}</Text>
    </View>;
  }
  const openReference = async (url: string) => {
    try { await Linking.openURL(url); }
    catch (failure: unknown) { if (failure instanceof Error) onLinkError(); else throw failure; }
  };
  return <View className="gap-3 rounded-lg border border-border bg-card p-4">
    <Text className="text-caption text-muted-foreground">
      {answer?.kind === "coaching" && answer.status === "answered" ? "내 금융 코칭" : answer ? ANSWER_STATUS_LABELS[answer.status] : "저장된 답변"}
    </Text>
    {answer?.period ? <Text className="text-caption text-muted-foreground">
      기준일 {answer.period.asOf}{"\n"}예측 기간 {answer.period.start} ~ {answer.period.end}
    </Text> : null}
    <Text selectable className="text-body">{message.text}</Text>
    {answer?.kind === "coaching" && answer.fallback ? <Text className="text-caption text-muted-foreground">
      추가 설명은 기본 문구로 표시했어요.
    </Text> : null}
    {answer?.references.map((reference) => <Pressable key={reference.id}
      className="min-h-touch flex-row items-center gap-2" accessibilityRole="link"
      accessibilityLabel={`${reference.title} 출처 열기`} onPress={() => { void openReference(reference.url); }}>
      <Icon as={ExternalLink} size={16} className="text-primary" />
      <Text className="flex-1 text-caption text-primary">{reference.title}</Text>
    </Pressable>)}
  </View>;
}
