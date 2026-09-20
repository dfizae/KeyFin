import { useRouter } from "expo-router";
import { Store } from "lucide-react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";

const HOME_ROUTE = "/";

/**
 * PAGE-29 상점 (P1, FR-GAM-05). 홈 상점 버튼에서 들어온다.
 * 아직 내용이 없다 — 슬롯 탭·보유 표시·구매가 `GET /shop`·`POST /shop/purchase` 에 기대는데 두 API 가 배포되지 않았다(명세 FR-GAM-05).
 * 자리만 먼저 잡아 둔 화면이며, API 가 나오면 마이페이지·리포트와 같은 순서로 내용을 채운다.
 */
function ShopScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="상점" onBack={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))} />
      <EmptyState
        icon={Store}
        title="준비 중인 화면이에요"
        description="코인으로 옷과 가구를 사는 상점을 준비하고 있어요."
      />
    </Screen>
  );
}

export { ShopScreen };
