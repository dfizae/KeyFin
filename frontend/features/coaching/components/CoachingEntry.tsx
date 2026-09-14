import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

export function CoachingEntry() {
  const router = useRouter();
  return <Button variant="outline" className="min-h-touch flex-row gap-2 rounded-lg" onPress={() => router.push("/coach")}>
    <Icon as={MessageCircle} size={20} className="text-primary" />
    <Text className="text-body-sm">AI에게 금융 질문하기</Text>
  </Button>;
}
