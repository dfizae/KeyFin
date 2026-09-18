import { View } from "react-native";

import { HomeScreen } from "@/features/home/components/HomeScreen";

export default function HomeRoute() {
  return (
    <View className="flex-1 bg-background">
      <HomeScreen />
    </View>
  );
}
