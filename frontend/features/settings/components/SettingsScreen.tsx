import { useRouter } from "expo-router";
import { CircleAlert, WifiOff } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Switch, View } from "react-native";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Screen, ScreenScrollView } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { useTransferSettings, useUpdateTransferSettings } from "@/features/settings/api/queries";
import { transferSettingsErrorMessage } from "@/features/settings/errors";
import {
  isSettingsDirty,
  settingsFormError,
  toSettingsForm,
  toTransferSettingsRequest,
  type TransferSettings,
  type TransferSettingsForm,
} from "@/features/settings/model";
import { getColors } from "@/lib/theme";

const MY_ROUTE = "/my";

/**
 * PAGE-27 설정 상세. P0 범위인 이체 동의와 1회·1일 한도(GET/PUT /settings/transfer, FR-PAY-04)만 다룬다.
 * 코치 말투·알림 on/off·방해 금지는 P1 이고 PUT /settings/notifications 는 상세 미확인이라 넣지 않았다.
 * 동의를 끄면 이체 실행 경로 자체가 막히므로(규칙 80) 한도 입력도 함께 비활성이다. Pencil 시안 없음.
 */
function SettingsScreen() {
  const router = useRouter();
  const settings = useTransferSettings();

  return (
    <Screen>
      <ScreenHeader title="설정" onBack={() => (router.canGoBack() ? router.back() : router.replace(MY_ROUTE))} />

      {settings.isPending ? (
        <SettingsSkeleton />
      ) : settings.data === undefined ? (
        <EmptyState
          icon={WifiOff}
          title="설정을 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => settings.refetch(), disabled: settings.isFetching }}
        />
      ) : (
        <TransferSettingsForm settings={settings.data} />
      )}
    </Screen>
  );
}

type TransferSettingsFormProps = {
  settings: TransferSettings;
};

function TransferSettingsForm({ settings }: TransferSettingsFormProps) {
  const { colorScheme } = useColorScheme();
  const colors = getColors(colorScheme);
  const update = useUpdateTransferSettings();
  const [form, setForm] = useState<TransferSettingsForm>(() => toSettingsForm(settings));

  const invalidReason = settingsFormError(form);
  const dirty = isSettingsDirty(form, settings);
  const canSave = dirty && invalidReason === null && !update.isPending;

  const patch = (next: Partial<TransferSettingsForm>) => setForm((current) => ({ ...current, ...next }));

  const save = () => {
    if (!canSave) return;
    update.mutate(toTransferSettingsRequest(form, settings), { onSuccess: (saved) => setForm(toSettingsForm(saved)) });
  };

  return (
    <>
      <ScreenScrollView contentContainerClassName="gap-10 px-6 pb-8" keyboardShouldPersistTaps="handled">
        <View className="gap-3 border-b border-border pb-6 pt-2">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-h3 text-foreground">결제 준비 이체 동의</Text>
            <Switch
              value={form.consent}
              onValueChange={(consent) => patch({ consent })}
              disabled={update.isPending}
              accessibilityLabel="결제 준비 이체 동의"
              accessibilityState={{ checked: form.consent, disabled: update.isPending }}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>
          <Text className="text-body-sm text-card-foreground">
            동의하면 결제일 전에 부족한 금액을 미리 옮길지 물어봐요. 옮기는 건 매번 직접 승인해야 해요.
          </Text>
          {form.consent ? null : (
            <Text className="text-caption text-card-foreground">동의를 끄면 준비 이체 제안과 실행이 모두 멈춰요.</Text>
          )}
        </View>

        <View className="gap-4">
          <Text className="text-label text-card-foreground">이체 한도</Text>
          <LimitField
            label="1회 한도"
            value={form.limitOnce}
            editable={form.consent && !update.isPending}
            onChange={(limitOnce) => patch({ limitOnce })}
          />
          <LimitField
            label="1일 한도"
            value={form.limitDaily}
            editable={form.consent && !update.isPending}
            onChange={(limitDaily) => patch({ limitDaily })}
          />
          <Text className="text-caption text-card-foreground">
            한도를 넘는 이체는 승인해도 서버가 막아요. 한도는 준비 이체에만 쓰이고 직접 하는 송금과는 관계없어요.
          </Text>
        </View>
      </ScreenScrollView>

      <View className="gap-2 px-6 pb-8 pt-2">
        {update.isError ? (
          <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <Icon as={CircleAlert} size={16} className="text-destructive" />
            <Text className="shrink text-caption text-destructive">{transferSettingsErrorMessage(update.error)}</Text>
          </View>
        ) : null}
        {invalidReason === null ? null : <Text className="text-caption text-card-foreground">{invalidReason}</Text>}
        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          disabled={!canSave}
          accessibilityState={{ disabled: !canSave }}
          accessibilityLabel="설정 저장"
          onPress={save}
        >
          <Text>{update.isPending ? "저장하는 중" : "저장"}</Text>
        </Button>
      </View>
    </>
  );
}

type LimitFieldProps = {
  label: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
};

function LimitField({ label, value, editable, onChange }: LimitFieldProps) {
  return (
    <View className="gap-2">
      <Text className="text-label text-foreground">{label}</Text>
      <AmountInput
        variant="field"
        className="h-input rounded-lg"
        value={value}
        onChangeValue={onChange}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

function SettingsSkeleton() {
  return (
    <View className="gap-6 px-6 pt-2" accessible accessibilityLabel="불러오는 중">
      <View className="gap-3 border-b border-border pb-6">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-10 w-full" />
      </View>
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </View>
  );
}

export { SettingsScreen };
