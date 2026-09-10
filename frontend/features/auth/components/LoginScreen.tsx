import { useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useLogin } from "@/features/auth/api/queries";
import { authErrorMessage } from "@/features/auth/errors";
import { canSubmitLogin } from "@/features/auth/model";
import { cn } from "@/lib/utils";

const HOME_ROUTE = "/";

// Pencil login (HUL5i) · login/error (JF0Db) · login/pending (bG1FL).
function LoginScreen() {
  const router = useRouter();
  const login = useLogin();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const errorMessage = login.isError ? authErrorMessage(login.error) : null;
  const canSubmit = canSubmitLogin(email, password) && !login.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // 온보딩 완료 여부로 분기하는 자리. 판정 기준이 미정이고 PAGE-03~06 이 없어 지금은 홈으로 보낸다. (TBD)
    login.mutate({ email: email.trim(), password }, { onSuccess: () => router.replace(HOME_ROUTE) });
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="flex-1 justify-between px-6 pb-8">
        <View className="gap-8 pt-16">
          <View className="gap-2">
            <Text className="text-display text-foreground" accessibilityRole="header">
              KeyFin
            </Text>
            <Text className="text-body-sm text-muted-foreground">봉투로 관리하는 우리 집 생활비</Text>
          </View>

          <View className="gap-4">
            <Field label="이메일">
              <Input
                className={cn("h-input rounded-lg", errorMessage !== null && "border-destructive")}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!login.isPending}
                accessibilityLabel="이메일"
                returnKeyType="next"
              />
            </Field>

            <Field label="비밀번호">
              <Input
                className={cn("h-input rounded-lg", errorMessage !== null && "border-destructive")}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                editable={!login.isPending}
                accessibilityLabel="비밀번호"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </Field>

            {errorMessage === null ? null : (
              <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
                <Icon as={CircleAlert} size={16} className="text-destructive" />
                <Text className="flex-1 text-body-sm text-destructive">{errorMessage}</Text>
              </View>
            )}
          </View>
        </View>

        <View className="gap-4">
          <Button
            size="lg"
            className="h-button-lg rounded-lg"
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityLabel="로그인"
          >
            <Text>{login.isPending ? "로그인 중…" : "로그인"}</Text>
          </Button>

          {/* 회원가입 화면(PAGE-02)이 생기면 여기로 연결한다. 그전까지는 자리만 둔다. (TBD) */}
          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="text-body-sm text-muted-foreground">계정이 없으신가요?</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="회원가입"
              accessibilityState={{ disabled: true }}
              disabled
              hitSlop={10}
            >
              <Text className="text-label text-primary">회원가입</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-caption text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

export { LoginScreen };
