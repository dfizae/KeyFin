import * as React from "react";
import type { FlatList, LayoutChangeEvent } from "react-native";

/** 최초 진입(0)과 전송 시도마다 다른 id를 준다. 답변이 오면 enabled를 꺼 예약된 이동도 취소한다. */
export function useCoachingChatScroll<ItemT>(
  listRef: React.RefObject<FlatList<ItemT> | null>,
  requestId: number,
  enabled: boolean
) {
  const contentHeight = React.useRef<number | null>(null);
  const viewportHeight = React.useRef(0);
  const laidOutRequest = React.useRef<number | null>(null);
  const pendingRequest = React.useRef<number | null>(null);
  const startedRequest = React.useRef<number | null>(null);
  const finishedRequest = React.useRef<number | null>(null);
  const frame = React.useRef<number | null>(null);

  const clearFrame = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const cancel = React.useCallback(() => {
    if (startedRequest.current !== null) finishedRequest.current = startedRequest.current;
    pendingRequest.current = null;
    clearFrame();
  }, [clearFrame]);

  const schedule = React.useCallback(() => {
    clearFrame();
    const id = pendingRequest.current;
    if (id === null || laidOutRequest.current !== id || contentHeight.current === null || viewportHeight.current <= 0) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pendingRequest.current !== id || listRef.current === null) return;
      pendingRequest.current = null;
      finishedRequest.current = id;
      listRef.current.scrollToOffset({
        offset: Math.max(0, (contentHeight.current ?? 0) - viewportHeight.current),
        animated: false,
      });
    });
  }, [clearFrame, listRef]);

  React.useLayoutEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }
    if (finishedRequest.current !== requestId) {
      startedRequest.current = requestId;
      pendingRequest.current = requestId;
      schedule();
    }
    // 언마운트와 요청 변경 시 예약만 폐기한다. StrictMode의 effect 재실행은 아직 완료하지 않은 요청을 이어 간다.
    return () => {
      pendingRequest.current = null;
      clearFrame();
    };
  }, [cancel, clearFrame, enabled, requestId, schedule]);

  const onContentSizeChange = React.useCallback((_width: number, height: number) => {
    contentHeight.current = height;
    schedule();
  }, [schedule]);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    schedule();
  }, [schedule]);

  // 요청마다 footer를 새로 배치한다. 높이가 같은 재시도도 새 렌더가 네이티브에 반영된 뒤 이동한다.
  const onRequestLayout = React.useCallback(() => {
    laidOutRequest.current = requestId;
    schedule();
  }, [requestId, schedule]);

  return { cancel, onContentSizeChange, onLayout, onRequestLayout };
}
