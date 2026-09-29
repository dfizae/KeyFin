---
name: fintech-ui-patterns
description: 모바일 핀테크 화면의 표준 패턴(금액 입력·표시, 계좌 카드, 거래 목록, 이체 플로우, PIN·생체 인증, 오류·빈 상태)을 React Native + NativeWind 기준으로 정의한다. 계좌·이체·결제·인증 관련 UI를 만들 때 사용한다.
metadata:
  author: project
  version: "1.0.0"
---

# fintech-ui-patterns

핀테크 화면은 "예쁘게"보다 "틀리지 않게"가 먼저다. 이 스킬은 자주 나오는 화면 단위의 요구사항과 구현 기준을 모아 둔 것이다. 값은 `design/tokens.json`, 의도는 `design/DESIGN.md`, 보안 규칙은 `.agents/rules/80-fintech-security.md`를 따른다.

## 공통 원칙

- 한 화면 한 목적. 잔액 화면에 광고 배너를 섞지 않는다.
- 돈과 관련된 숫자는 항상 `tabular-nums`, 부호 또는 입금/출금 텍스트, 통화 단위(원)를 함께 표시한다.
- 로딩은 스켈레톤, 실패는 인라인 오류 + 재시도, 빈 목록은 `EmptyState`. 세 상태를 만들지 않은 화면은 완성이 아니다.
- 모든 터치 요소는 44pt 이상, `accessibilityRole`과 `accessibilityLabel`을 갖는다. 금액을 읽어주는 라벨은 "삼만원"이 아니라 "30,000원"처럼 화면 텍스트와 같게 한다.
- 키보드가 CTA를 가리지 않도록 `KeyboardAvoidingView`와 하단 고정 버튼을 함께 검토한다.

## 패턴별 기준

`references/patterns.md`에 화면·컴포넌트별 체크리스트가 있다. 작업 전에 해당 항목을 읽는다.

| 패턴 | 요약 |
|---|---|
| AmountText | 크기 lg/md/sm, `sign` prop, 마이너스는 `text-destructive`, 플러스는 `text-positive`, 0은 `text-foreground` |
| AmountInput | 문자열 상태, 콤마 자동 포맷, 최대 자릿수, 한도 초과 시 필드 아래 오류, 빠른 금액 칩(+1만/+10만/전액) |
| AccountCard | 은행명·별칭·마스킹 계좌번호·잔액(`amount-md`)·잔액 숨김 토글, 눌림 상태 `bg-muted` |
| TransactionRow | 좌: 상대방·메모·시각, 우: 금액(`amount-sm`)·잔액. `pending`은 `text-muted-foreground` + "처리 중" |
| Transfer flow | 받는 사람 → 금액 → 확인 → 인증 → 완료. 각 단계는 별도 라우트, 상태는 `features/transfer/store.ts`(Zustand) 한 곳 |
| Confirm screen | 금액 `amount-lg`, 받는 사람·계좌(마스킹)·수수료·도착 예정, CTA "이체하기"는 하단 고정 56pt, 멱등성 키 생성 지점 |
| PinPad | 6자리, 점 인디케이터, 셔플 옵션, 실패 횟수 표시, 햅틱, 뒤로가기 시 초기화 |
| Biometric | `expo-local-authentication`, 실패·미등록 → PinPad 폴백, 성공 후 서버 인증 별도 |
| Error / Empty | `EmptyState`(아이콘·제목·설명·액션 1개), 네트워크 오류는 연결 상태 안내 + 재시도 |
| Skeleton | 실제 레이아웃과 같은 크기, 1초 이내면 표시하지 않음 |

## 구현 순서 (화면 하나 기준)

1. `design/design-map.json`에서 Pencil 노드 확인 → 있으면 `pencil-design` 절차 B로 대조, `없음`이면 `DESIGN.md` 기준 + "Pencil 미대조" 표시.
2. `references/patterns.md`에서 해당 패턴의 체크리스트를 읽는다.
3. 화면 모델(`features/<domain>/model.ts`)과 Query/Mutation 훅을 먼저 정의한다(`20-api-data.md`).
4. 공용 컴포넌트가 없으면 `components/ui/`에 인벤토리 이름으로 만든다.
5. 로딩·빈·오류·비활성 상태를 함께 구현한다.
6. `pnpm tokens:check`, `pnpm typecheck` 통과 확인.

## 금지

- 금액을 `number`로 계산하거나 `toLocaleString`을 컴포넌트에서 직접 호출하지 않는다 (`lib/money.ts` 사용).
- 이체 CTA에 자동 재시도, 더블탭 허용, 파라미터만으로 실행을 두지 않는다.
- 카드·계좌 전체 번호를 기본 노출하지 않는다.
