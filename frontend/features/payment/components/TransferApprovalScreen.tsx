import { useRouter } from "expo-router";
import { ArrowDown, CalendarClock, CircleAlert, CircleCheck, ShieldOff, WifiOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { useAccounts } from "@/features/account/api/queries";
import type { LinkedAccount } from "@/features/account/model";
import { useApproveTransfer, usePostponeTransfer, useTransfers } from "@/features/payment/api/queries";
import { isUnconfirmedTransferError, transferApproveErrorMessage, transferPostponeErrorMessage } from "@/features/payment/errors";
import { canApproveTransfer, findTransfer, transferStatusLabel, type Transfer } from "@/features/payment/model";
import { useTransferSettings } from "@/features/settings/api/queries";
import { currentMonthKey, formatDateTime, formatMonthDay, parseKSTDateKey, parseKSTLocalDateTime } from "@/lib/date";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

const CALENDAR_ROUTE = "/payment/calendar";
const SETTINGS_ROUTE = "/my/settings";
const HOME_ROUTE = "/";

type TransferApprovalScreenProps = {
  /** 라우트 파라미터에서 검증한 이체 제안 id. 형식이 틀리면 null */
  transferId: number | null;
};

/**
 * PAGE-25 이체 승인 (FR-PAY-03·04). 07:00 TRANSFER_REQUEST 푸시의 진입점이다.
 * 규칙 80: 동의가 꺼져 있으면 실행 경로를 아예 열지 않고, 승인은 확인 다이얼로그를 거치며,
 * 요청 중에는 버튼을 잠가 같은 제안 id 로 두 번 보내지 않는다. 자동 재시도는 하지 않고
 * 네트워크 오류로 결과를 모를 때는 서버 상태(GET /transfers)로 확정한다. Pencil 시안 없음.
 */
function TransferApprovalScreen({ transferId }: TransferApprovalScreenProps) {
  const router = useRouter();
  const settings = useTransferSettings();
  const transfers = useTransfers({ month: currentMonthKey() });
  const accounts = useAccounts();
  const approve = useApproveTransfer();
  const postpone = usePostponeTransfer();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const transfer = transferId === null ? null : findTransfer(transfers.data ?? [], transferId);
  const isPending = approve.isPending || postpone.isPending;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(HOME_ROUTE);
  };

  const runApprove = () => {
    if (transfer === null || isPending) return;
    setConfirmOpen(false);
    approve.mutate(transfer.id);
  };

  const runPostpone = () => {
    if (transfer === null || isPending) return;
    postpone.mutate(transfer.id, { onSuccess: goBack });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="이체 승인" onBack={goBack} />

      {settings.isPending || transfers.isPending ? (
        <ApprovalSkeleton />
      ) : settings.data?.consent === false ? (
        <EmptyState
          icon={ShieldOff}
          title="이체 동의가 꺼져 있어요"
          description="설정에서 결제 준비 이체에 동의하면 제안을 받을 수 있어요."
          action={{ label: "설정 열기", onPress: () => router.replace(SETTINGS_ROUTE) }}
        />
      ) : transfers.data === undefined ? (
        <EmptyState
          icon={WifiOff}
          title="이체 제안을 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => transfers.refetch(), disabled: transfers.isFetching }}
        />
      ) : transfer === null ? (
        <EmptyState
          icon={CalendarClock}
          title="준비할 결제가 없어요"
          description="결제일이 가까워지면 미리 옮길지 물어볼게요."
          action={{ label: "결제 캘린더", onPress: () => router.replace(CALENDAR_ROUTE) }}
        />
      ) : (
        <>
          <ScrollView contentContainerClassName="gap-5 px-6 pb-8">
            <TransferSummary transfer={transfer} accounts={accounts.data} />
            {transfer.status === "PROPOSED" ? (
              <LimitNote once={settings.data?.limitOnce} daily={settings.data?.limitDaily} />
            ) : (
              <ResultCard transfer={transfer} />
            )}
          </ScrollView>

          <View className="gap-2 px-6 pb-8 pt-2">
            {approve.isError ? (
              <ErrorLine
                message={transferApproveErrorMessage(approve.error)}
                action={
                  isUnconfirmedTransferError(approve.error)
                    ? { label: "상태 새로 고침", onPress: () => transfers.refetch() }
                    : null
                }
              />
            ) : null}
            {postpone.isError ? <ErrorLine message={transferPostponeErrorMessage(postpone.error)} action={null} /> : null}

            {canApproveTransfer(transfer) ? (
              <>
                <Button
                  size="lg"
                  className="h-button-lg rounded-lg"
                  disabled={isPending}
                  accessibilityState={{ disabled: isPending }}
                  accessibilityLabel="이체하기"
                  onPress={() => setConfirmOpen(true)}
                >
                  <Text>{approve.isPending ? "이체하는 중" : "이체하기"}</Text>
                </Button>
                <Button
                  variant="outline"
                  className="h-button-md rounded-lg"
                  disabled={isPending}
                  accessibilityState={{ disabled: isPending }}
                  accessibilityLabel="나중에"
                  onPress={runPostpone}
                >
                  <Text>{postpone.isPending ? "미루는 중" : "나중에"}</Text>
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="h-button-lg rounded-lg" onPress={() => router.replace(CALENDAR_ROUTE)}>
                <Text>결제 캘린더 보기</Text>
              </Button>
            )}
          </View>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-h3 text-foreground">{formatKRW(transfer.requiredAmount)}을 옮길까요?</DialogTitle>
                <DialogDescription className="text-body-sm text-card-foreground">
                  {accountLabel(accounts.data, transfer.fromAccountId)} → {accountLabel(accounts.data, transfer.toAccountId)}
                  {"\n"}
                  {formatMonthDay(parseKSTDateKey(transfer.scheduledDate))} {transfer.purposeName} 출금에 쓸 돈이에요.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onPress={() => setConfirmOpen(false)}>
                  <Text>취소</Text>
                </Button>
                <Button disabled={isPending} onPress={runApprove}>
                  <Text>이체하기</Text>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </View>
  );
}

/** 계좌 이름은 GET /accounts 에서 찾고, 못 찾으면 id 만 보여준다. 계좌번호는 마스킹된 값뿐이다 (규칙 80) */
function accountLabel(accounts: LinkedAccount[] | undefined, accountId: number): string {
  const account = accounts?.find((item) => item.accountId === accountId);
  if (account === undefined) return `계좌 #${accountId}`;
  return `${account.alias ?? account.bankName} ${account.maskedNo}`;
}

type TransferSummaryProps = {
  transfer: Transfer;
  accounts: LinkedAccount[] | undefined;
};

// Pencil 이체 승인 · 카드 정리 대안 (o8TlhF): 카드 없이 금액이 본문에 바로 놓인다.
function TransferSummary({ transfer, accounts }: TransferSummaryProps) {
  return (
    <View className="gap-4 pb-1 pt-3">
      <View className="gap-1">
        <Text className="text-caption text-card-foreground">
          {formatMonthDay(parseKSTDateKey(transfer.scheduledDate))} · {transfer.purposeName}
        </Text>
        <Text className="text-h2 text-foreground">준비할 금액</Text>
      </View>
      <Text className="text-amount-lg tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
        {formatKRW(transfer.requiredAmount)}
      </Text>
      <View className="gap-2">
        <AccountLine label="출금 계좌" value={accountLabel(accounts, transfer.fromAccountId)} />
        <Icon as={ArrowDown} size={16} className="text-card-foreground" />
        <AccountLine label="결제 계좌" value={accountLabel(accounts, transfer.toAccountId)} />
      </View>
    </View>
  );
}

type AccountLineProps = { label: string; value: string };

function AccountLine({ label, value }: AccountLineProps) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-caption text-card-foreground">{label}</Text>
      <Text className="shrink text-label tabular-nums text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type LimitNoteProps = { once: string | undefined; daily: string | undefined };

// 한도는 서버가 실행 직전 검사한다. 화면은 지금 설정값을 알려주기만 한다 (FR-PAY-04).
function LimitNote({ once, daily }: LimitNoteProps) {
  if (once === undefined || daily === undefined) return null;

  return (
    <Text className="text-caption tabular-nums text-card-foreground">
      1회 한도 {formatKRW(once)} · 1일 한도 {formatKRW(daily)} 안에서 실행돼요. 넘으면 서버가 막아요.
    </Text>
  );
}

type ResultCardProps = { transfer: Transfer };

// 결과는 서버 상태를 그대로 보여준다. 실패 사유도 서버 문구를 고치지 않는다 (명세 §5).
// 카드가 아니라 상태 색 띠다(금융망 이메일의 안내 띠와 같은 모양): 성공 positive-muted · 실패 destructive-muted · 그 외 muted.
function ResultCard({ transfer }: ResultCardProps) {
  const failed = transfer.status === "FAILED";
  const executed = transfer.status === "EXECUTED";

  return (
    <View
      className={cn(
        "gap-2 rounded-lg p-3.5",
        failed ? "bg-destructive-muted" : executed ? "bg-positive-muted" : "bg-muted"
      )}
    >
      <View className="flex-row items-center gap-2">
        <Icon
          as={failed ? CircleAlert : CircleCheck}
          size={20}
          className={failed ? "text-destructive" : executed ? "text-positive" : "text-card-foreground"}
        />
        <Text className="text-h3 text-foreground">{transferStatusLabel(transfer.status)}</Text>
      </View>
      {executed && transfer.executedAt !== null ? (
        <Text className="text-body-sm tabular-nums text-card-foreground">
          {formatDateTime(parseKSTLocalDateTime(transfer.executedAt))}에 옮겼어요.
        </Text>
      ) : null}
      {failed ? (
        <>
          <Text className="text-body-sm text-destructive">{transfer.failReason ?? "실패 사유를 받지 못했어요."}</Text>
          <Text className="text-caption text-card-foreground">다시 시도는 준비 중이에요. 계좌 잔액을 확인한 뒤 결제일 전에 직접 옮겨 주세요.</Text>
        </>
      ) : null}
      {transfer.status === "APPROVED" ? (
        <Text className="text-body-sm text-card-foreground">승인을 받아 실행하는 중이에요. 결과가 나오면 알림으로 알려드려요.</Text>
      ) : null}
      {transfer.status === "CANCELED" || transfer.status === "UNKNOWN" ? (
        <Text className="text-body-sm text-card-foreground">이 제안은 더 이상 실행되지 않아요.</Text>
      ) : null}
    </View>
  );
}

type ErrorLineProps = {
  message: string;
  action: { label: string; onPress: () => void } | null;
};

function ErrorLine({ message, action }: ErrorLineProps) {
  return (
    <View className="gap-1" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-1.5">
        <Icon as={CircleAlert} size={16} className="text-destructive" />
        <Text className="shrink text-caption text-destructive">{message}</Text>
      </View>
      {action === null ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={8} onPress={action.onPress}>
          <Text className="text-caption text-primary">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ApprovalSkeleton() {
  return (
    <View className="gap-4 px-6 pt-3" accessible accessibilityLabel="불러오는 중">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-11 w-48" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/4" />
    </View>
  );
}

export { TransferApprovalScreen };
export type { TransferApprovalScreenProps };
