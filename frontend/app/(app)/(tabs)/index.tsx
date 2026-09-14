import { SafeAreaView } from "react-native-safe-area-context";

import { HomeScreen } from "@/features/home/components/HomeScreen";

export default function HomeRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <HomeScreen />
    </SafeAreaView>
  );
}
