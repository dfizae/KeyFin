import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ENVELOPE_CATALOG } from "@/features/budget/catalog";
import { USER_EXCLUDE_TAGS } from "@/features/transaction/catalog";
import type { ClassifyRequest, Subcategory } from "@/features/transaction/model";
import { cn } from "@/lib/utils";

// PAGE-20 거래 분류 시트 (Pencil 시안 없음 — DESIGN.md BottomSheet 규약: bg-popover · rounded-xl 상단 · 여백 20).
// 세분류 22종을 봉투 순서로 묶고, 아래에 제외 태그 3종을 둔다. subcategoryId 와 excludeTag 중 하나만 보낸다.
export const SHEET_TITLE = "카테고리 선택";
export const SHEET_CLOSE_LABEL = "시트 닫기";

type SubcategorySheetProps = {
  visible: boolean;
  subcategories: Subcategory[] | undefined;
  /** 현재 제안된 세분류. 선택 표시용 */
  selectedSubcategoryId: number | null;
  disabled?: boolean;
  onSelect: (request: ClassifyRequest) => void;
  onClose: () => void;
};

function SubcategorySheet({ visible, subcategories, selectedSubcategoryId, disabled = false, onSelect, onClose }: SubcategorySheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="flex-1 bg-black/50" accessibilityRole="button" accessibilityLabel={SHEET_CLOSE_LABEL} onPress={onClose} />
        <View className="rounded-t-xl bg-popover pb-8">
          <View className="flex-row items-center justify-between px-5 pt-5">
            <Text className="text-h3 text-popover-foreground" accessibilityRole="header">
              {SHEET_TITLE}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={8} className="h-touch w-touch items-center justify-center">
              <Icon as={X} size={20} className="text-card-foreground" />
            </Pressable>
          </View>
          <ScrollView className="max-h-96" contentContainerClassName="gap-4 px-5 pt-3">
            {subcategories ? (
              ENVELOPE_CATALOG.map((envelope) => (
                <ChipGroup
                  key={envelope.id}
                  title={envelope.name}
                  chips={subcategories
                    .filter((subcategory) => subcategory.envelopeId === envelope.id)
                    .map((subcategory) => ({
                      key: `sub-${subcategory.id}`,
                      label: subcategory.name,
                      selected: subcategory.id === selectedSubcategoryId,
                      request: { subcategoryId: subcategory.id } as ClassifyRequest,
                    }))}
                  disabled={disabled}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <View className="gap-3" accessibilityLabel="세분류 불러오는 중" accessible>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-3/4 rounded-lg" />
              </View>
            )}
            <ChipGroup
              title="예산에서 제외"
              chips={USER_EXCLUDE_TAGS.map((tag) => ({
                key: `tag-${tag.tag}`,
                label: tag.label,
                hint: tag.description,
                selected: false,
                request: { excludeTag: tag.tag } as ClassifyRequest,
              }))}
              disabled={disabled}
              onSelect={onSelect}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type Chip = { key: string; label: string; hint?: string; selected: boolean; request: ClassifyRequest };

type ChipGroupProps = {
  title: string;
  chips: Chip[];
  disabled: boolean;
  onSelect: (request: ClassifyRequest) => void;
};

function ChipGroup({ title, chips, disabled, onSelect }: ChipGroupProps) {
  return (
    <View className="gap-2">
      <Text className="text-label text-card-foreground">{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            accessibilityHint={chip.hint}
            accessibilityState={{ selected: chip.selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(chip.request)}
            className={cn(
              "min-h-touch justify-center rounded-lg border px-4 active:opacity-70",
              chip.selected ? "border-primary bg-accent" : "border-border bg-card",
              disabled && "opacity-50"
            )}
          >
            <Text className={cn("text-label", chip.selected ? "text-primary" : "text-foreground")}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export { SubcategorySheet };
export type { SubcategorySheetProps };
