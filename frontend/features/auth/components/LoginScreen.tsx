import { useLocalSearchParams, useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import * as React from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useLogin } from "@/features/auth/api/queries";
import { authErrorMessage } from "@/features/auth/errors";
import { canSubmitLogin, parseReturnTo } from "@/features/auth/model";
import { cn } from "@/lib/utils";

/** Pencil login (HUL5i) 의 Main Logo 1 (LfIsh) 을 3배로 내보낸 이미지 */
const LOGO = require("@/assets/brand/keyfin-logo.png");

/** NativeWind className 은 RN Image 에 적용되지 않아 크기만 style 로 준다. 폭에 맞춰 contain 하면 시안의 338x91 과 같아진다. */
const LOGO_STYLE = { width: "100%", height: 96 } as const;

const SIGNUP_ROUTE = "/(auth)/signup";

// Pencil login (HUL5i) · login/error (JF0Db) · login/pending (bG1FL).
function LoginScreen() {
  const router = useRouter();
  const login = useLogin();

  // 가입 직후 돌아오면 방금 만든 이메일을 채워 두고 안내를 한 줄 보여준다.
  const { signedUpEmail, returnTo } = useLocalSearchParams<{ signedUpEmail?: string; returnTo?: string }>();
  const [email, setEmail] = React.useState(signedUpEmail ?? "");
  const [password, setPassword] = React.useState("");

  const errorMessage = login.isError ? authErrorMessage(login.error) : null;
  const canSubmit = canSubmitLogin(email, password) && !login.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // 온보딩 완료 여부로 분기하는 자리. 판정 기준이 미정이고 PAGE-03~06 이 없어 지금은 홈으로 보낸다. (TBD)
    // 푸시·딥링크로 들어왔다 로그인한 경우 원래 보려던 화면으로 돌아간다 (규칙 50).
    login.mutate({ email: email.trim(), password }, { onSuccess: () => router.replace(parseReturnTo(returnTo)) });
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="flex-1 justify-between px-6 pb-8">
        <View className="gap-8 pt-16">
          <Image
            source={LOGO}
            style={LOGO_STYLE}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="KeyFin"
          />

          {signedUpEmail === undefined ? null : (
            <View className="rounded-lg bg-positive-muted px-4 py-3" accessibilityLiveRegion="polite">
              <Text className="text-body-sm text-foreground">가입이 완료됐어요. 로그인해 주세요.</Text>
            </View>
          )}

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

          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="text-body-sm text-muted-foreground">계정이 없으신가요?</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="회원가입"
              hitSlop={10}
              onPress={() => router.push(SIGNUP_ROUTE)}
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
