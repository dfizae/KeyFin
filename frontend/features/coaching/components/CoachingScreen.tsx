import { useRouter } from "expo-router";
import { ArrowLeft, MessageCircle } from "lucide-react-native";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { CoachingMessage } from "@/features/coaching/components/CoachingMessage";
import { useCoachingChat } from "@/features/coaching/useCoachingChat";

const EXAMPLES = ["예금과 적금은 어떻게 달라?", "이번 달 내 지출은 얼마야?", "이번 달 말까지 잔액 예측해줘"] as const;

export function CoachingScreen({ sessionId, coachingId, notificationId }: {
  readonly sessionId?: string; readonly coachingId?: string; readonly notificationId?: string;
}) {
  const router = useRouter();
  const chat = useCoachingChat(sessionId, coachingId, notificationId);
  const [question, setQuestion] = React.useState("");
  const [linkError, setLinkError] = React.useState(false);
  const scroll = React.useRef<ScrollView>(null);
  const submit = async () => { if (await chat.send(question)) setQuestion(""); };

  return <SafeAreaView className="flex-1 bg-background">
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-3">
        <Button variant="ghost" size="icon" accessibilityLabel="뒤로"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/")}>
          <Icon as={ArrowLeft} size={24} className="text-foreground" />
        </Button>
        <View className="flex-1"><Text className="text-h2">AI 금융 코칭</Text>
          <Text className="text-caption text-muted-foreground">금융 개념부터 내 소비와 예측까지</Text></View>
        <Button variant="ghost" size="sm" onPress={() => router.push("/coach-notifications")}><Text>알림</Text></Button>
      </View>
      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="gap-4 px-5 py-6"
        keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {chat.messages.length === 0 && !chat.busy ? <View className="gap-4">
          <Icon as={MessageCircle} size={28} className="text-primary" />
          <Text className="text-h2">어떤 점이 궁금하세요?</Text>
          <Text className="text-body-sm text-muted-foreground">
            금융 개념은 계좌 연결 없이 물어볼 수 있어요. 내 소비와 예측에는 연결된 거래·잔액 자료가 필요해요.
          </Text>
          {EXAMPLES.map((example) => <Button key={example} variant="outline" className="h-auto min-h-touch rounded-lg p-3"
            accessibilityLabel={example} onPress={() => setQuestion(example)}><Text className="flex-1 text-body-sm">{example}</Text></Button>)}
        </View> : null}
        {chat.messages.map((message) => <CoachingMessage key={message.id} message={message} onLinkError={() => setLinkError(true)} />)}
        {chat.busy ? <Text accessibilityLiveRegion="polite" className="text-body-sm text-muted-foreground">답변을 준비하고 있어요…</Text> : null}
        {chat.error ? <View className="gap-2 rounded-lg bg-muted p-4">
          <Text accessibilityRole="alert" className="text-body-sm">{chat.error}</Text>
          <Button variant="outline" disabled={chat.busy} onPress={() => { void chat.retry(); }}><Text>다시 시도</Text></Button>
          {chat.retryPending ? <Button variant="ghost" disabled={chat.busy} onPress={chat.changeQuestion}><Text>질문 바꾸기</Text></Button> : null}
        </View> : null}
        {linkError ? <Text accessibilityRole="alert" className="text-body-sm text-destructive">출처 링크를 열지 못했어요.</Text> : null}
      </ScrollView>
      <View className="gap-2 border-t border-border bg-card px-5 py-3">
        <Input accessibilityLabel="금융 질문" placeholder="궁금한 금융 질문을 입력하세요" value={question}
          onChangeText={setQuestion} maxLength={2000} multiline className="min-h-input rounded-lg"
          editable={!chat.busy && !chat.retryPending} />
        <Button className="h-button-md rounded-lg" accessibilityLabel="질문 보내기"
          disabled={chat.busy || chat.retryPending || question.trim().length === 0} onPress={() => { void submit(); }}>
          <Text>{chat.busy ? "답변 받는 중…" : "질문 보내기"}</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
