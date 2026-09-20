import { useRouter } from "expo-router";
import { Shirt } from "lucide-react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";

const HOME_ROUTE = "/";

/**
 * 옷장 — 보유한 착장을 갈아입는 화면 (P1, FR-GAM-05 장착). 홈 옷장 버튼에서 들어온다 (사용자 요청 2026-09-20).
 * 명세에 독립 PAGE 번호가 없고 `GET /items`·`PATCH /items/{userItemId}` 도 배포되지 않아 자리만 잡아 둔다.
 * 방 가구 배치는 '꾸미기'(PAGE-11)가 맡고 여기는 캐릭터 착장만 다룬다.
 */
function WardrobeScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="옷장" onBack={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))} />
      <EmptyState
        icon={Shirt}
        title="준비 중인 화면이에요"
        description="가지고 있는 옷으로 캐릭터를 갈아입히는 화면을 준비하고 있어요."
      />
    </Screen>
  );
}

export { WardrobeScreen };
