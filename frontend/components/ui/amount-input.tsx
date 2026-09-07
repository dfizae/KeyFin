import * as React from "react";
import { Pressable, View } from "react-native";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  addKRW,
  compareKRW,
  formatAmountInput,
  formatKRW,
  sanitizeAmountInput,
  type KRW,
} from "@/lib/money";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_DIGITS = 12;
const QUICK_AMOUNTS: readonly { label: string; value: KRW }[] = [
  { label: "+1만", value: "10000" },
  { label: "+5만", value: "50000" },
  { label: "+10만", value: "100000" },
];
const FULL_AMOUNT_LABEL = "전액";

function formattedLength(maxDigits: number): number {
  return maxDigits + Math.floor((maxDigits - 1) / 3);
}

function exceedsMax(value: string, max: KRW | undefined): boolean {
  return max !== undefined && value !== "" && compareKRW(value, max) > 0;
}

type AmountInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChangeText" | "keyboardType" | "inputMode" | "maxLength"
> & {
  value: string;
  onChangeValue: (digits: string) => void;
  max?: KRW;
  maxDigits?: number;
  errorMessage?: string;
};

function AmountInput({
  value,
  onChangeValue,
  max,
  maxDigits = DEFAULT_MAX_DIGITS,
  errorMessage,
  editable = true,
  className,
  accessibilityLabel = "금액",
  ...props
}: AmountInputProps) {
  const overMax = exceedsMax(value, max);
  const message = errorMessage ?? (overMax && max !== undefined ? `${formatKRW(max)}까지 입력할 수 있어요` : undefined);
  const invalid = message !== undefined;

  const handleChangeText = (text: string) => {
    onChangeValue(sanitizeAmountInput(text, { maxDigits }));
  };

  const handleAdd = (amount: KRW) => {
    onChangeValue(sanitizeAmountInput(addKRW(value === "" ? "0" : value, amount), { maxDigits }));
  };

  const handleFullAmount = () => {
    if (max !== undefined) onChangeValue(sanitizeAmountInput(max, { maxDigits }));
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Input
          value={formatAmountInput(value)}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={formattedLength(maxDigits)}
          editable={editable}
          placeholder="0"
          textAlign="right"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !editable }}
          aria-invalid={invalid}
          maxFontSizeMultiplier={1.3}
          className={cn(
            "h-input flex-1 rounded-lg text-amount-lg tabular-nums",
            invalid && "border-destructive",
            className
          )}
          {...props}
        />
        <Text className="text-amount-md text-foreground" maxFontSizeMultiplier={1.3}>
          원
        </Text>
      </View>

      {message !== undefined ? (
        <Text className="text-body-sm text-destructive" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {QUICK_AMOUNTS.map((quick) => (
          <QuickAmountChip
            key={quick.value}
            label={quick.label}
            disabled={!editable}
            onPress={() => handleAdd(quick.value)}
          />
        ))}
        {max !== undefined ? (
          <QuickAmountChip label={FULL_AMOUNT_LABEL} disabled={!editable} onPress={handleFullAmount} />
        ) : null}
      </View>
    </View>
  );
}

type QuickAmountChipProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function QuickAmountChip({ label, disabled, onPress }: QuickAmountChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn(
        "min-h-touch items-center justify-center rounded-full border border-border bg-background px-4 active:bg-muted",
        disabled && "opacity-50"
      )}
    >
      <Text className="text-label text-foreground">{label}</Text>
    </Pressable>
  );
}

export { AmountInput };
export type { AmountInputProps };
