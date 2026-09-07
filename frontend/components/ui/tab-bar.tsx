import type { Tabs } from "expo-router";
import { Calculator, ChartColumn, House, User, Wallet, type LucideIcon } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

// Pencil 홈 BottomTabBar (NaYk9) 의 Tab-* 프레임 안 아이콘 이름 = lucide 이름
const TAB_ICONS: Record<string, LucideIcon> = {
  index: House,
  assets: Wallet,
  budget: Calculator,
  report: ChartColumn,
  my: User,
};

// Pencil Tabs 프레임 padding [12,16,8,16]. 홈 인디케이터 영역은 safe area 로 대체한다.
const MIN_BOTTOM_INSET = 8;

function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between border-t border-border bg-background px-4 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const focused = state.index === index;
        const label = typeof options?.title === "string" ? options.title : route.name;
        const icon = TAB_ICONS[route.name] ?? House;

        const handlePress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={handlePress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            className={cn(
              "h-12 min-w-touch items-center justify-center gap-1 rounded-lg px-3 py-1",
              focused ? "bg-accent" : "active:opacity-70"
            )}
          >
            <Icon as={icon} size={20} className={focused ? "text-primary" : "text-muted-foreground"} />
            <Text className={cn("text-caption", focused ? "text-primary" : "text-muted-foreground")}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { TabBar };
export type { TabBarProps };
