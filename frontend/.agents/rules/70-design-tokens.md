---
paths:
  - "app/**"
  - "components/**"
  - "features/**"
  - "design/**"
  - "tailwind.config.js"
  - "global.css"
  - "lib/theme.ts"
  - "components.json"
---

# 디자인 토큰, React Native Reusables, Pencil 연동

## 원천과 산출물

- 디자인의 확정 원천은 Pencil 작업 파일 `design.pen`이다. 코드가 읽는 형태는 `design/tokens.json`(값)과 `design/DESIGN.md`(의도)이며, `AGENTS.md`나 대화 속 문장이 아니라 이 파일들을 기준으로 UI를 만든다.
- `design/tokens.json`은 `design.pen`의 문서 변수에서 `pnpm tokens:sync`(`scripts/sync-pen-tokens.cjs`)로 동기화한다. 손으로 수정하지 않는다. 토큰을 바꿔야 하면 Pencil 변수를 먼저 바꾸고(`SetVariables`, 절차는 `pencil-design` 스킬 C) 동기화한다. `tokens:check`가 `design.pen`과 `tokens.json`의 불일치를 잡으며, `tokens.json`을 고쳐 맞추지 않고 Pencil을 고친다. Pencil 변수에 없는 토큰(`radius.full`, 타이포, 모션 등)은 코드 전용이며 사용자 승인을 받아 `tokens.json`에서 직접 관리한다.
- Figma는 `pnpm figma:build`(`scripts/figma/`)로 Pencil을 내보내는 공유용 출력물이다. 코드 구현·대조·토큰의 근거로 Figma를 읽지 않는다.
- `tailwind.config.js`, `global.css`, `lib/theme.ts`는 `pnpm tokens:sync`가 생성한다. 이 세 파일을 직접 편집하지 않는다. 생성 로직 변경은 `scripts/sync-tokens.cjs`에서 한다.
- UI 코드를 변경한 뒤에는 `pnpm tokens:check`를 실행하고 통과해야 완료로 본다.

## 토큰 사용

- 색상 className에는 시맨틱 토큰만 사용한다. 이름은 shadcn/React Native Reusables 규약(`X`, `X-foreground`, `X-muted`)을 따른다: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `border-border`, `border-input`, `text-positive`, `text-destructive`, `bg-destructive-muted`, `text-highlight`, `bg-inverse` 등. 전체 목록은 `design/DESIGN.md` 2장.
- 프리미티브 팔레트(`bg-slate-100`, `text-blue-600`)는 테마에 존재하지 않으므로 사용하지 않는다. `white`, `black`은 모드 무관 고정 토큰으로 허용한다(`text-white`, `bg-black/50`).
- hex, `rgb()`, arbitrary value(`p-[13px]`, `bg-[#fff]`)를 UI 코드에 쓰지 않는다. 필요한 값이 토큰에 없으면 기존 토큰으로 표현할 수 있는지 먼저 검토하고, 그래도 필요하면 Pencil 변수에 토큰을 추가한 뒤 동기화한다.
- 라이트/다크는 CSS 변수(`:root` / `.dark:root`)로 자동 전환된다. `dark:` variant를 색상에 직접 쓰지 않는다. 다크 모드에서만 구조가 달라져야 하는 경우(그림자 → 테두리 등)에만 `dark:`를 사용한다. 테마 전환은 NativeWind `useColorScheme().setColorScheme`로만 한다.
- 타이포는 `text-h1`, `text-body`, `text-amount-lg` 같은 타이포 토큰 클래스를 사용한다. 이 클래스는 크기·행간·자간·가중치를 함께 설정하므로 `text-2xl font-semibold`처럼 조합하지 않는다. Tailwind 기본 `text-sm` 등은 RNR 컴포넌트 내부에서만 쓴다.
- 금액과 숫자 열에는 `tabular-nums` 클래스를 항상 함께 지정한다.
- 간격은 Tailwind 기본 4px 스케일만 사용한다. 모서리는 `rounded-sm|md|lg|xl|2xl|3xl|full`만 사용한다. 크기 토큰 `h-touch`, `h-button-lg`, `h-button-md`, `h-input`, `w-icon`을 우선한다.
- className으로 표현할 수 없는 값(StatusBar 스타일, 내비게이션 테마, 차트 색, Reanimated 보간)은 `lib/theme.ts`의 `getColors(scheme)`, `typography`, `radius` 등을 사용한다.

## React Native Reusables (components/ui)

- 공용 UI의 기반은 React Native Reusables(RNR, shadcn 규약)다. `components.json`이 설정되어 있으며 새 컴포넌트는 `pnpm ui:add https://reactnativereusables.com/r/nativewind/<name>.json`으로 추가한다. `npx @react-native-reusables/cli add`는 pnpm 빌드 승인 경고에 걸려 실패할 수 있으므로 위 명령을 사용한다.
- 추가된 파일은 벤더 파일이다. 첫 줄의 `// vendor: react-native-reusables` 주석을 유지하고 원본을 최대한 수정하지 않는다. 프로젝트 수정이 필요하면 해당 줄에 `// project:` 주석을 남긴다. `tokens:check`는 벤더 파일에서 arbitrary value·프리미티브 팔레트 검사를 면제하지만 hex와 `StyleSheet.create`는 검사한다.
- 텍스트는 React Native `Text` 대신 `@/components/ui/text`의 `Text`를 사용한다(`font-sans`로 Pretendard가 적용된다). 아이콘은 `@/components/ui/icon`의 `Icon as={LucideIcon}`을 사용한다.
- RNR `Text`의 `variant`(`h1`~`h4`, `lead`, `muted` 등)는 웹 기본값(`text-4xl font-extrabold` 등)이므로 화면 코드에서 쓰지 않는다. 크기·가중치는 타이포 토큰 클래스(`className="text-h1"`)로만 지정한다. `variant`는 RNR 내부 컴포넌트(`CardTitle` 등)가 쓰는 것만 허용한다.
- 버튼은 RNR `Button`(variant `default`=primary, `secondary`, `outline`, `ghost`, `destructive`, `link`)을 사용하고 새로운 버튼 컴포넌트를 만들지 않는다. 주요 CTA는 `size="lg"` + `h-button-lg`.
- RNR에 없는 도메인 컴포넌트(`AmountText`, `AmountInput`, `EmptyState`, `Toast`, `BottomSheet`, `ListGroup`)는 RNR 컴포넌트를 조합해 `components/ui/`에 kebab-case 파일로 만든다. 이름은 `design/DESIGN.md` 5-2 인벤토리를 따른다.
- 경로 별칭 `@/`는 프로젝트 루트다(`tsconfig.json` paths).

## 컴포넌트와 Pencil 대응

- 공용 컴포넌트의 이름, variant, size는 `design/DESIGN.md` 5장의 인벤토리와 Pencil 컴포넌트 이름을 그대로 따른다. Pencil `Button / primary / lg` → `<Button variant="default" size="lg">`, `Button / secondary` → `variant="secondary"`.
- 화면을 구현하기 전에 `design/design-map.json`에서 해당 화면·컴포넌트의 `pencil` 노드를 찾는다. 노드가 있으면 Pencil MCP `Get`(프레임 자체의 fill·layout·크기까지)과 `TakeScreenshot`으로 대조한 뒤 구현하고(`pencil-design` 스킬 절차 B), `없음`이면 `DESIGN.md` 기준으로 구현하고 보고서에 "Pencil 미대조"로 표시한다.
- Pencil에 없는 컴포넌트를 새로 만들 때는 `DESIGN.md` 인벤토리와 `design-map.json`에 항목을 추가한다(`pencil: "없음"`).
- Pencil 작업 파일은 `design.pen`이며 `pencil-design` 스킬의 규약을 따른다. 킷 원본 프레임(`Home`, `로그인` …)은 참고 자료이고, 구현 기준은 `screens` 키 이름의 아트보드(`home`, `home/dark` …)다.

## 보고

- UI 작업 보고에는 참조한 Pencil 노드(`이름 (id)` 또는 "미대조"), `pnpm tokens:check` 결과, 새로 추가·요청한 토큰 목록, 새로 추가한 RNR 컴포넌트를 포함한다.
