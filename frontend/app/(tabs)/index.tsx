import { SafeAreaView } from "react-native-safe-area-context";

import { HomeScreen } from "@/features/account/components/HomeScreen";

export default function HomeRoute() {
  return (
    <SafeAreaView className="flex-1 bg-primary" edges={["top"]}>
      <HomeScreen />
    </SafeAreaView>
  );
}
