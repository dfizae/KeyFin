import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { RoomSceneFrame } from "@/features/room/components/RoomSceneFrame";

// 웹에서는 CanvasKit(wasm)을 먼저 내려받아야 Skia 컴포넌트를 쓸 수 있다.
// canvaskit-wasm 은 pnpm 격리 때문에 앱 코드에서 직접 참조할 수 없어, Skia 패키지가 고정한 버전을 읽어 CDN 경로를 만든다.
const CANVASKIT_VERSION: string = require("@shopify/react-native-skia/package.json").dependencies["canvaskit-wasm"];
const locateFile = (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/${file}`;

function RoomSceneLoader() {
  return (
    <RoomSceneFrame>
      {(width) => (
        <WithSkiaWeb
          getComponent={() => import("@/features/room/components/RoomScene")}
          componentProps={{ width }}
          fallback={<Skeleton className="h-full w-full rounded-xl" />}
          opts={{ locateFile }}
        />
      )}
    </RoomSceneFrame>
  );
}

export { RoomSceneLoader };
