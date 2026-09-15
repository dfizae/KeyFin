import { useRouter } from "expo-router";
import { ChevronLeft, CircleAlert, Info } from "lucide-react-native";
import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useConnectFinance } from "@/features/link/api/queries";
import { financeErrorMessage, isRetryableFinanceError } from "@/features/link/errors";
import { canSubmitFinanceEmail, FINANCE_EMAIL_MAX_LENGTH } from "@/features/link/model";
import { cn } from "@/lib/utils";

/** PAGE-04(계좌·카드 연결)가 생기면 그쪽으로 보낸다. 그전까지는 홈으로 간다. (TBD) */
const NEXT_ROUTE = "/";

// Pencil finance-email (mDdag) · finance-email/error (B6jV5).
function FinanceEmailScreen() {
  const router = useRouter();
  const connect = useConnectFinance();

  const [email, setEmail] = React.useState("");

  const errorMessage = connect.isError ? financeErrorMessage(connect.error) : null;
  const canRetry = connect.isError && isRetryableFinanceError(connect.error);
  const canSubmit = canSubmitFinanceEmail(email) && !connect.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    connect.mutate({ financeEmail: email.trim() }, { onSuccess: () => router.replace(NEXT_ROUTE) });
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="flex-row items-center px-6 pb-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={10}
          onPress={() => router.canGoBack() && router.back()}
        >
          <Icon as={ChevronLeft} size={24} className="text-foreground" />
        </Pressable>
      </View>

      <View className="flex-1 justify-between px-6 pb-8">
        <View className="gap-8 pt-6">
          <View className="gap-2">
            <Text className="text-h1 text-foreground" accessibilityRole="header">
              금융망 이메일을 확인해 주세요
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              SSAFY 금융망에 가입한 이메일로 계좌·카드를 불러옵니다. KeyFin 가입 이메일과 달라도 괜찮아요.
            </Text>
          </View>

          <View className="gap-4">
            <View className="gap-1.5">
              <Text className="text-caption text-muted-foreground">금융망 이메일</Text>
              <Input
                className={cn("h-input rounded-lg", errorMessage !== null && "border-destructive")}
                value={email}
                onChangeText={setEmail}
                placeholder="finance@qwer.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={FINANCE_EMAIL_MAX_LENGTH}
                editable={!connect.isPending}
                accessibilityLabel="금융망 이메일"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              {errorMessage === null ? null : (
                <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
                  <Icon as={CircleAlert} size={16} className="text-destructive" />
                  <Text className="flex-1 text-body-sm text-destructive">
                    {canRetry ? errorMessage : `${errorMessage} 다른 이메일을 입력해 주세요.`}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center gap-2 rounded-lg bg-info-muted p-3.5">
              <Icon as={Info} size={16} className="text-info" />
              <Text className="flex-1 text-caption text-foreground">회원가입에 쓴 이메일과 다를 수 있어요.</Text>
            </View>
          </View>
        </View>

        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel="연결하기"
        >
          <Text>{connect.isPending ? "연결하는 중…" : "연결하기"}</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

export { FinanceEmailScreen };
