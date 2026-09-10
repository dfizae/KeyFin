import { useRouter } from "expo-router";
import { ChevronLeft, CircleAlert } from "lucide-react-native";
import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useSignup } from "@/features/auth/api/queries";
import { authErrorMessage } from "@/features/auth/errors";
import { canSubmitSignup } from "@/features/auth/model";
import { cn } from "@/lib/utils";

const LOGIN_ROUTE = "/(auth)/login";

/** 이미 쓰는 이메일인지는 서버(USER_002)만 안다. 그 오류는 이메일 필드 아래에 붙인다. */
const EMAIL_ERROR_CODES = ["USER_002"];

// Pencil signup (ZjEHu) · signup/error (UdUD7) · signup/pending (b1O9sc).
function SignupScreen() {
  const router = useRouter();
  const signup = useSignup();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const errorMessage = signup.isError ? authErrorMessage(signup.error) : null;
  const isEmailError =
    signup.isError && EMAIL_ERROR_CODES.includes((signup.error as { code?: string })?.code ?? "");
  const canSubmit = canSubmitSignup(email, password, name) && !signup.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    signup.mutate(
      { email: email.trim(), password, name: name.trim() },
      // 가입은 토큰을 주지 않는다. 로그인 화면으로 보내면서 방금 만든 이메일을 넘겨 다시 입력하지 않게 한다.
      { onSuccess: () => router.replace({ pathname: LOGIN_ROUTE, params: { signedUpEmail: email.trim() } }) }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="flex-row items-center px-6 pb-2">
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={10} onPress={() => router.back()}>
          <Icon as={ChevronLeft} size={24} className="text-foreground" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 pt-6" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          <Text className="text-h1 text-foreground" accessibilityRole="header">
            계정 만들기
          </Text>
          <Text className="text-body-sm text-muted-foreground">이메일과 비밀번호로 KeyFin 을 시작해요</Text>
        </View>

        <View className="gap-4">
          <Field label="이름">
            <Input
              className="h-input rounded-lg"
              value={name}
              onChangeText={setName}
              placeholder="김싸피"
              autoCapitalize="none"
              autoComplete="name"
              textContentType="name"
              editable={!signup.isPending}
              accessibilityLabel="이름"
              returnKeyType="next"
            />
          </Field>

          <Field label="이메일">
            <Input
              className={cn("h-input rounded-lg", isEmailError && "border-destructive")}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!signup.isPending}
              accessibilityLabel="이메일"
              returnKeyType="next"
            />
            {errorMessage !== null && isEmailError ? <InlineError message={errorMessage} /> : null}
          </Field>

          <Field label="비밀번호">
            <Input
              className="h-input rounded-lg"
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!signup.isPending}
              accessibilityLabel="비밀번호"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </Field>

          {errorMessage !== null && !isEmailError ? <InlineError message={errorMessage} /> : null}
        </View>
      </ScrollView>

      <View className="gap-4 px-6 pb-8">
        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel="가입하기"
        >
          <Text>{signup.isPending ? "가입하는 중…" : "가입하기"}</Text>
        </Button>

        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-body-sm text-muted-foreground">이미 계정이 있으신가요?</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="로그인" hitSlop={10} onPress={() => router.back()}>
            <Text className="text-label text-primary">로그인</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
      <Icon as={CircleAlert} size={16} className="text-destructive" />
      <Text className="flex-1 text-body-sm text-destructive">{message}</Text>
    </View>
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

export { SignupScreen };
