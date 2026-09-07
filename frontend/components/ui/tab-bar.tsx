import type { Tabs } from "expo-router";
import { House, Mail, Search, Settings, type LucideIcon } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TAB_ICONS: Record<string, LucideIcon> = {
  index: House,
  search: Search,
  messages: Mail,
  settings: Settings,
};

const MIN_BOTTOM_INSET = 20;

function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between bg-card px-10 pt-5 dark:border-t dark:border-border"
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
            hitSlop={8}
            className={cn(
              "h-9 min-w-touch flex-row items-center justify-center gap-2 rounded-full",
              focused ? "bg-primary px-4" : "active:bg-muted"
            )}
          >
            <Icon as={icon} size={focused ? 20 : 24} className={focused ? "text-primary-foreground" : "text-muted-foreground"} />
            {focused ? <Text className="text-caption text-primary-foreground">{label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export { TabBar };
export type { TabBarProps };
