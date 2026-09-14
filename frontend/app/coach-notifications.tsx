import { Redirect } from "expo-router";
import { View } from "react-native";

import { selectAuthStatus, selectTermsAgreed, useAuthStore } from "@/features/auth/store";
import { CoachingNotificationsScreen } from "@/features/coaching/components/CoachingNotificationsScreen";

export default function CoachNotificationsRoute() {
  const status = useAuthStore(selectAuthStatus);
  const terms = useAuthStore(selectTermsAgreed);
  if (status === "loading") return <View className="flex-1 bg-background" />;
  if (status === "anonymous") return <Redirect href="/(auth)/login" />;
  if (terms === false) return <Redirect href="/(auth)/terms" />;
  return <CoachingNotificationsScreen />;
}
