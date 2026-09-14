import { Redirect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { selectAuthStatus, selectTermsAgreed, useAuthStore } from "@/features/auth/store";
import { CoachingScreen } from "@/features/coaching/components/CoachingScreen";

/** A general question needs authentication, but must not be blocked by finance onboarding. */
export default function CoachRoute() {
  const status = useAuthStore(selectAuthStatus);
  const terms = useAuthStore(selectTermsAgreed);
  const params = useLocalSearchParams<{ session?: string | string[]; coaching?: string | string[]; notification?: string | string[] }>();
  if (status === "loading") return <View className="flex-1 bg-background" />;
  if (status === "anonymous") return <Redirect href="/(auth)/login" />;
  if (terms === false) return <Redirect href="/(auth)/terms" />;
  if (Array.isArray(params.session) || Array.isArray(params.coaching) || Array.isArray(params.notification)) {
    return <View className="flex-1 bg-background p-5"><Text>대화 주소를 확인해 주세요.</Text></View>;
  }
  return <CoachingScreen key={`${params.session ?? ""}:${params.coaching ?? ""}:${params.notification ?? ""}`}
    sessionId={params.session} coachingId={params.coaching} notificationId={params.notification} />;
}
