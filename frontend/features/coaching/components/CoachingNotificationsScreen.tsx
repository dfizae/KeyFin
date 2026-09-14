import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import * as React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/error";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getCoachingNotifications } from "@/features/coaching/api";
import type { CoachingNotification } from "@/features/coaching/model";

/** The inbox reads the server outbox; it does not claim that an OS push was delivered. */
export function CoachingNotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = React.useState<readonly CoachingNotification[]>([]);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    void getCoachingNotifications().then((notifications) => {
      if (active) { setItems(notifications); setError(null); }
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof ApiError ? failure.message : "알림을 불러오지 못했어요.");
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [version]);

  return <SafeAreaView className="flex-1 bg-background">
    <View className="flex-row items-center gap-3 border-b border-border px-5 py-3">
      <Button variant="ghost" size="icon" accessibilityLabel="코칭으로 돌아가기" onPress={() => router.replace("/coach")}>
        <Icon as={ArrowLeft} size={24} className="text-foreground" />
      </Button>
      <Text className="flex-1 text-h2">코칭 알림</Text>
      <Button variant="ghost" size="sm" disabled={busy} onPress={() => { setBusy(true); setVersion((value) => value + 1); }}>
        <Text>새로고침</Text>
      </Button>
    </View>
    <ScrollView contentContainerClassName="gap-4 px-5 py-6">
      {busy ? <Text accessibilityLiveRegion="polite">알림을 불러오고 있어요…</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {!busy && !error && items.length === 0 ? <Text className="text-muted-foreground">아직 도착한 코칭 알림이 없어요.</Text> : null}
      {items.map((item) => <Button key={item.event_id} variant="outline" className="h-auto min-h-touch items-start rounded-lg p-4"
        accessibilityLabel={`${item.acknowledged ? "읽은 알림" : "새 알림"}: ${item.text}`}
        onPress={() => router.push({ pathname: "/coach", params: { coaching: item.coaching_id, notification: item.event_id } })}>
        <Text className="text-body-sm">{item.text}</Text>
        <Text className="text-caption text-muted-foreground">{item.acknowledged ? "읽음" : "새 알림"} · 코칭 열기</Text>
      </Button>)}
    </ScrollView>
  </SafeAreaView>;
}
