import { useRouter } from "expo-router";
import { ChevronLeft, Circle, CircleCheckBig } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { canAgreeToTerms, TERMS_ITEMS } from "@/features/auth/model";
import { useAuthStore } from "@/features/auth/store";
import { saveTermsAgreed } from "@/lib/session-storage";
import { cn } from "@/lib/utils";

/** 약관 다음은 금융망 이메일 연결(PAGE-03B)이다 (유저 플로우 v2, 2026-09-10). */
const NEXT_ROUTE = "/onboarding/finance-email";

const CLAUSES = [
  {
    title: "제1조 (목적)",
    body: "이 약관은 KeyFin 및 관련 자산 연동 서비스를 이용함에 있어 회사와 회원의 권리·의무를 정합니다.",
  },
  {
    title: "제2조 (개인정보 수집 및 이용)",
    body: "회사는 자산 연동과 예산 리포트 제공을 위해 필요 최소한의 개인정보를 수집하며 수집 시 목적을 고지합니다.",
  },
  {
    title: "제3조 (서비스 제공 및 변경)",
    body: "서비스는 24시간 제공을 원칙으로 하나 점검 등 불가피한 사유가 있으면 사전 고지 후 중단될 수 있습니다.",
  },
];

// Pencil terms (R2GYj). 서버 호출이 없어 동의는 기기에만 남긴다.
function TermsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const agreeToTerms = useAuthStore((state) => state.agreeToTerms);

  const [checkedIds, setCheckedIds] = React.useState<string[]>([]);
  const allChecked = checkedIds.length === TERMS_ITEMS.length;
  const canContinue = canAgreeToTerms(checkedIds);

  const toggle = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setCheckedIds(allChecked ? [] : TERMS_ITEMS.map((item) => item.id));
  };

  const handleContinue = async () => {
    if (!canContinue || user === null) return;
    await saveTermsAgreed(user.id);
    agreeToTerms();
    router.replace(NEXT_ROUTE);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-6 pb-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={10}
          onPress={() => router.canGoBack() && router.back()}
        >
          <Icon as={ChevronLeft} size={24} className="text-foreground" />
        </Pressable>
        <Text className="text-h3 text-foreground" accessibilityRole="header">
          약관 동의
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 pt-4">
        <View className="gap-2">
          <Text className="text-h1 text-foreground" accessibilityRole="header">
            약관에 동의해 주세요
          </Text>
          <Text className="text-body-sm text-muted-foreground">자산을 연결하고 예산을 만들려면 아래 약관이 필요해요.</Text>
        </View>

        <View className="gap-2.5 rounded-lg bg-muted p-4">
          {CLAUSES.map((clause) => (
            <View key={clause.title} className="gap-1">
              <Text className="text-label text-foreground">{clause.title}</Text>
              <Text className="text-caption text-muted-foreground">{clause.body}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3.5">
          <Pressable
            className="flex-row items-center gap-2.5 rounded-lg bg-accent px-4 py-3.5"
            accessibilityRole="checkbox"
            accessibilityLabel="전체 동의"
            accessibilityState={{ checked: allChecked }}
            onPress={toggleAll}
          >
            <CheckMark checked={allChecked} />
            <Text className="text-h3 text-foreground">전체 동의</Text>
          </Pressable>

          <View className="gap-3 px-1">
            {TERMS_ITEMS.map((item) => {
              const checked = checkedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  className="flex-row items-center gap-2.5"
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked }}
                  onPress={() => toggle(item.id)}
                  hitSlop={6}
                >
                  <CheckMark checked={checked} />
                  <Text className={cn("flex-1 text-body-sm", checked ? "text-foreground" : "text-muted-foreground")}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-8 pt-3">
        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityLabel="동의하고 계속하기"
        >
          <Text>동의하고 계속하기</Text>
        </Button>
      </View>
    </View>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <Icon
      as={checked ? CircleCheckBig : Circle}
      size={20}
      className={checked ? "text-primary" : "text-muted-foreground"}
    />
  );
}

export { TermsScreen };
