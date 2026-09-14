import { useRouter } from "expo-router";
import { CalendarClock, Check, ChevronLeft, CircleAlert, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAccounts } from "@/features/account/api/queries";
import type { LinkedAccount } from "@/features/account/model";
import {
  useCachedFixedExpense,
  useCreateFixedExpense,
  useDeleteFixedExpense,
  useUpdateFixedExpense,
} from "@/features/payment/api/queries";
import { EXPENSE_TYPE_CATALOG } from "@/features/payment/catalog";
import { fixedExpenseDeleteErrorMessage, fixedExpenseSaveErrorMessage } from "@/features/payment/errors";
import {
  MAX_PAYMENT_DAY,
  MIN_PAYMENT_DAY,
  fixedExpenseFormError,
  toFixedExpenseRequest,
  type CalendarEntry,
  type ExpenseType,
  type FixedExpenseForm,
  type FixedExpenseRoute,
} from "@/features/payment/model";
import { toWon } from "@/lib/money";
import { cn } from "@/lib/utils";

const CALENDAR_ROUTE = "/payment/calendar";

type FixedExpenseFormScreenProps = {
  /** 라우트 파라미터에서 검증한 값. null 이면 주소가 잘못됐다 */
  route: FixedExpenseRoute;
};

/**
 * PAGE-26 고정지출 등록·수정 (FR-PAY-07). 이름·유형·금액·출금일(1~31)·출금 계좌를 받아
 * POST /fixed-expenses 또는 PUT /fixed-expenses/{id} 로 보낸다. 삭제는 확인 다이얼로그를 거친다.
 * 수정은 단건 조회 API 가 없어 캘린더 캐시로 폼을 채우고, 유형은 캘린더 응답에 없어 기본값에서 고른다 (TBD).
 * Pencil 시안 없음.
 */
function FixedExpenseFormScreen({ route }: FixedExpenseFormScreenProps) {
  const router = useRouter();
  const cached = useCachedFixedExpense(route?.mode === "edit" ? route.id : null);
  const accounts = useAccounts();
  const create = useCreateFixedExpense();
  const update = useUpdateFixedExpense();
  const remove = useDeleteFixedExpense();
  const [form, setForm] = useState<FixedExpenseForm>(() => initialForm(cached));
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isEdit = route?.mode === "edit";
  const invalidReason = fixedExpenseFormError(form);
  const isPending = create.isPending || update.isPending || remove.isPending;
  const saveError = create.error ?? update.error;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(CALENDAR_ROUTE);
  };

  const patch = (next: Partial<FixedExpenseForm>) => setForm((current) => ({ ...current, ...next }));

  const submit = () => {
    if (invalidReason !== null || route === null) return;
    const request = toFixedExpenseRequest(form);
    if (route.mode === "create") create.mutate(request, { onSuccess: goBack });
    else update.mutate({ id: route.id, request }, { onSuccess: goBack });
  };

  const confirmDelete = () => {
    if (route?.mode !== "edit") return;
    setDeleteOpen(false);
    remove.mutate(route.id, { onSuccess: goBack });
  };

  if (route === null || (isEdit && cached === null)) {
    return (
      <View className="flex-1 bg-background">
        <FormHeader title="고정지출" onBack={goBack} />
        <EmptyState
          icon={CalendarClock}
          title="고정지출을 찾을 수 없어요"
          description="결제 캘린더에서 다시 열어 주세요."
          action={{ label: "결제 캘린더", onPress: () => router.replace(CALENDAR_ROUTE) }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FormHeader title={isEdit ? "고정지출 수정" : "고정지출 등록"} onBack={goBack} />

      <ScrollView contentContainerClassName="gap-6 px-6 pb-8" keyboardShouldPersistTaps="handled">
        <Field label="이름">
          <Input
            className="h-input rounded-lg"
            value={form.name}
            onChangeText={(name) => patch({ name })}
            placeholder="월세, 넷플릭스 …"
            accessibilityLabel="고정지출 이름"
            maxLength={30}
            editable={!isPending}
          />
        </Field>

        <Field label="유형">
          <View className="flex-row flex-wrap gap-2">
            {EXPENSE_TYPE_CATALOG.map((option) => (
              <TypeChip
                key={option.type}
                label={option.label}
                selected={form.expenseType === option.type}
                disabled={isPending}
                onPress={() => patch({ expenseType: option.type })}
              />
            ))}
          </View>
          {form.expenseType === "UTILITY" ? (
            <Text className="text-caption text-card-foreground">공과금은 달마다 금액이 달라 예상액으로 준비해 둬요.</Text>
          ) : null}
        </Field>

        <Field label="금액">
          <AmountInput
            className="h-input rounded-lg"
            value={form.amount}
            onChangeValue={(amount) => patch({ amount })}
            editable={!isPending}
          />
        </Field>

        <Field label="출금일">
          <View className="flex-row items-center gap-2">
            <Input
              className="h-input w-20 rounded-lg text-center"
              value={form.paymentDay}
              onChangeText={(raw) => patch({ paymentDay: raw.replace(/[^0-9]/g, "").slice(0, 2) })}
              keyboardType="number-pad"
              accessibilityLabel="출금일"
              editable={!isPending}
            />
            <Text className="text-body text-foreground">일</Text>
          </View>
          <Text className="text-caption text-card-foreground">
            {MIN_PAYMENT_DAY}~{MAX_PAYMENT_DAY} 중에 고르면 돼요. 29~31일은 그 날짜가 없는 달이면 말일에 나가요.
          </Text>
        </Field>

        <Field label="출금 계좌">
          <AccountPicker
            accounts={accounts.data}
            isPending={accounts.isPending}
            isError={accounts.isError}
            disabled={isPending}
            selectedId={form.withdrawalAccountId}
            onSelect={(withdrawalAccountId) => patch({ withdrawalAccountId })}
            onRetry={() => accounts.refetch()}
          />
        </Field>

        {isEdit ? (
          <Button
            variant="ghost"
            className="h-button-md rounded-lg"
            disabled={isPending}
            accessibilityLabel="고정지출 삭제"
            onPress={() => setDeleteOpen(true)}
          >
            <Icon as={Trash2} size={18} className="text-destructive" />
            <Text className="text-destructive">삭제</Text>
          </Button>
        ) : null}
      </ScrollView>

      <View className="gap-2 px-6 pb-8 pt-2">
        {saveError === null || saveError === undefined ? null : (
          <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <Icon as={CircleAlert} size={16} className="text-destructive" />
            <Text className="shrink text-caption text-destructive">{fixedExpenseSaveErrorMessage(saveError)}</Text>
          </View>
        )}
        {remove.error === null ? null : (
          <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <Icon as={CircleAlert} size={16} className="text-destructive" />
            <Text className="shrink text-caption text-destructive">{fixedExpenseDeleteErrorMessage(remove.error)}</Text>
          </View>
        )}
        {invalidReason === null ? null : <Text className="text-caption text-card-foreground">{invalidReason}</Text>}
        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          disabled={invalidReason !== null || isPending}
          accessibilityState={{ disabled: invalidReason !== null || isPending }}
          onPress={submit}
        >
          <Text>{isPending ? "저장하는 중" : isEdit ? "저장" : "등록"}</Text>
        </Button>
      </View>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-h3 text-foreground">이 고정지출을 삭제할까요?</DialogTitle>
            <DialogDescription className="text-body-sm text-card-foreground">
              삭제하면 결제 캘린더와 준비 이체 제안에서 빠져요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onPress={() => setDeleteOpen(false)}>
              <Text>그대로 둘게요</Text>
            </Button>
            <Button variant="destructive" onPress={confirmDelete}>
              <Text>삭제</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const DEFAULT_EXPENSE_TYPE: ExpenseType = "SUBSCRIPTION";

/** 수정은 캘린더 항목으로 채운다. 유형은 캘린더 응답에 없어 기본값에서 사용자가 다시 고른다 (TBD) */
function initialForm(cached: CalendarEntry | null): FixedExpenseForm {
  if (cached === null) {
    return { name: "", expenseType: DEFAULT_EXPENSE_TYPE, amount: "", paymentDay: "", withdrawalAccountId: null };
  }
  return {
    name: cached.name,
    expenseType: DEFAULT_EXPENSE_TYPE,
    amount: String(toWon(cached.amount)),
    paymentDay: String(cached.day),
    withdrawalAccountId: cached.withdrawalAccountId,
  };
}

type FormHeaderProps = {
  title: string;
  onBack: () => void;
};

function FormHeader({ title, onBack }: FormHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 px-6 pb-3">
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={10} onPress={onBack}>
        <Icon as={ChevronLeft} size={24} className="text-foreground" />
      </Pressable>
      <Text className="text-h3 text-foreground" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <View className="gap-2">
      <Text className="text-label text-card-foreground">{label}</Text>
      {children}
    </View>
  );
}

type TypeChipProps = {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
};

function TypeChip({ label, selected, disabled, onPress }: TypeChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "min-h-touch justify-center rounded-lg border px-4 active:opacity-70",
        selected ? "border-primary bg-accent" : "border-border bg-card",
        disabled && "opacity-50"
      )}
    >
      <Text className={cn("text-label", selected ? "text-primary" : "text-foreground")}>{label}</Text>
    </Pressable>
  );
}

type AccountPickerProps = {
  accounts: LinkedAccount[] | undefined;
  isPending: boolean;
  isError: boolean;
  disabled: boolean;
  selectedId: number | null;
  onSelect: (accountId: number) => void;
  onRetry: () => void;
};

// 출금 계좌는 GET /accounts 의 연결 계좌뿐이다. 계좌번호는 마스킹된 값만 보여준다 (규칙 80).
function AccountPicker({ accounts, isPending, isError, disabled, selectedId, onSelect, onRetry }: AccountPickerProps) {
  if (isPending) return <Skeleton className="h-14 w-full rounded-lg" />;
  if (isError || accounts === undefined) {
    return (
      <Pressable accessibilityRole="button" className="h-input justify-center" onPress={onRetry}>
        <Text className="text-label text-primary">계좌를 불러오지 못했어요. 다시 시도</Text>
      </Pressable>
    );
  }
  if (accounts.length === 0) {
    return <Text className="text-body-sm text-card-foreground">연결된 계좌가 없어요. 자산 탭에서 계좌를 먼저 연결해 주세요.</Text>;
  }

  return (
    <View className="gap-2">
      {accounts.map((account) => {
        const selected = account.accountId === selectedId;
        const name = account.alias ?? account.bankName;
        return (
          <Pressable
            key={account.accountId}
            accessibilityRole="button"
            accessibilityLabel={`${name} ${account.maskedNo}`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(account.accountId)}
            className={cn(
              "min-h-touch flex-row items-center justify-between gap-3 rounded-lg border px-4 py-3 active:opacity-70",
              selected ? "border-primary bg-accent" : "border-border bg-card",
              disabled && "opacity-50"
            )}
          >
            <View className="flex-1">
              <Text className="text-label text-foreground" numberOfLines={1}>
                {name}
              </Text>
              <Text className="text-caption tabular-nums text-card-foreground">{account.maskedNo}</Text>
            </View>
            {selected ? <Icon as={Check} size={18} className="text-primary" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export { FixedExpenseFormScreen };
export type { FixedExpenseFormScreenProps };
