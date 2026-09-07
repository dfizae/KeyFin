---
name: pencil-design
description: Pencil(pen.dev) design.pen이 디자인의 확정 원천이다. 화면·컴포넌트 구현 전 Pencil 노드 대조(절차 B), 새 화면 드래프트(절차 A), Pencil 변수 → design/tokens.json 동기화(절차 C)를 다룬다. UI 구현, 화면 시안, 토큰 변경, "디자인대로 만들어줘" 요청에 사용한다.
metadata:
  author: project
  version: "2.0.0"
---

# pencil-design

**Pencil(`design.pen`)이 디자인의 단일 확정 원천이다.** 코드는 Pencil 아트보드를 대조해 구현하고, 토큰은 Pencil 문서 변수에서 동기화한다. Figma는 `pnpm figma:build`로 내보내는 공유용 출력물일 뿐 코드가 읽지 않는다.

## 언제 쓰는가

- 화면·컴포넌트를 구현하기 전(매 UI 작업) — 절차 B
- 아직 없는 화면의 시안이 필요할 때, 레이아웃 대안 비교, 플로우 시안 — 절차 A
- 색·반경·크기·서체 토큰을 바꿀 때 — 절차 C
- "이 화면 어떻게 생길지 그려줘", "Pencil대로 만들어줘", "토큰 바꿔줘" 류의 요청

## 전제

- Pencil 에디터에 `design.pen`이 열려 있어야 MCP가 응답한다. 응답이 없으면 파일을 열어 달라고 요청한다.
- 작업 시작 시 순서대로 호출한다:
  1. `mcp__pencil__get_app_state` — 열린 파일·선택 상태·최상위 노드 확인
  2. `mcp__pencil__read_skill` — Pencil 공식 스킬(`.pen` 스키마·`execute` API). 조작법의 원천이며 본 문서는 프로젝트 규약만 다룬다.
- `design.pen`은 평문 JSON이다. **에이전트는 MCP(`execute`의 `Get`·`TakeScreenshot`)로 읽고**, `scripts/sync-pen-tokens.cjs`·`scripts/figma/build-plugin.cjs` 같은 빌드 스크립트만 파일을 직접 읽는다. Read/Grep으로 3.8MB 파일을 통째로 열지 않는다.
- Pencil은 Google 폰트만 렌더한다. `$font-sans`는 Pretendard로 두되 캔버스에서는 폴백 서체로 보인다 — 서체 모양은 캔버스로 판단하지 않는다.

## 프로젝트 규약

### 파일과 아트보드

- 메인 작업 파일은 리포 루트 `design.pen`. 대안 탐색만 `design/pencil/<flow>-<screen>.pen`으로 분리한다.
- 구현 기준 아트보드 이름 = `design/design-map.json`의 `screens` 키(`home`, `transfer-amount`, …). 다크 모드는 `home/dark`처럼 슬래시 + `theme: {mode: "dark"}`. 대안은 `transfer-amount/alt-1`.
- 프레임 390×844, `clip: true`, `layout: vertical`. 안전 영역 상단 59·하단 34.
- Figma UI 킷에서 붙여넣은 원본 프레임(`Home`, `로그인`, `Components`, `Icons` …)은 참고 자료로 남긴다. 구현 기준은 항상 `screens` 키 이름의 아트보드다.

### 토큰과 변수

- 문서 변수 51개 = `tokens.json`의 시맨틱 색 35개(테마 light/dark) + `white`/`black` + `radius-*` + `size-*` + `font-sans`. 이름이 곧 `tokens.json` 경로다(`primary` → `semantic.color.primary`, `radius-lg` → `semantic.radius.lg`).
- 도형·텍스트 색은 `$변수`만 참조한다(`fill: "$primary"`). 임의 hex를 아트보드에 직접 찍지 않는다. 킷 원본 프레임의 raw hex는 예외(참고 자료).
- 텍스트는 `fontFamily: "$font-sans"` + `DESIGN.md` 3장의 크기·가중치·행간(`h1` 24/28 600, `body` 16/24 400, `amount-lg` 36/44 700 …). `Text style / tokens` 프레임(khZeU)의 샘플을 복사해 쓴다.
- 간격은 4의 배수, 좌우 여백 24, 카드 패딩 20, 모서리는 `$radius-*`만.
- 새 색·크기가 필요하면 **변수를 먼저 추가**(`SetVariables`, 테마 값은 light/dark 둘 다)하고 절차 C로 동기화한다. 변수 없이 값을 쓰지 않는다.

### 컴포넌트

- `DESIGN.md` 5장 인벤토리 이름으로 프레임을 만든다(`Button / primary / lg`, `AccountCard / default`, `TransactionRow / withdrawal`).
- 같은 컴포넌트를 두 번 이상 쓰면 Pencil 컴포넌트(`reusable: true`)로 만들고 `ref`로 배치한다.
- 아이콘은 `icon` 노드(`library: "lucide"`, `icon: "<lucide 이름>"`)를 쓴다. 이모지·텍스트 라벨로 대체하지 않는다.

### 핀테크 화면에서 반드시 표현할 것

- 금액은 tabular 숫자, 부호(`+`/`-`) 또는 "입금/출금" 텍스트를 색과 함께.
- 계좌번호는 마스킹 상태(`110-***-**6789`)가 기본.
- 이체 확인 화면은 받는 사람·계좌·금액·수수료·도착 예정을 모두 포함.
- 로딩(스켈레톤)·빈 상태·오류 상태 아트보드를 최소 하나씩. 실패한 요청에는 재시도 버튼.
- 주요 CTA는 하단 고정, 높이 `$size-button-lg`(56), 안전 영역 위.

## 절차 A — 새 화면 드래프트

1. `design-map.json`의 `screens`에 키가 있는지 확인한다. 없으면 라우트와 함께 추가한다(`pencil: "없음"` 상태로).
2. `get_app_state` → `read_skill`.
3. 토큰 변수가 파일에 없으면 먼저 정의한다(현재는 51개가 정의돼 있다 — `Print(GetVariables())`로 확인).
4. `FindEmptySpace`로 빈자리를 잡고 아트보드를 그린다. 대안은 가로로 나란히.
5. `TakeScreenshot`으로 확인해 사용자에게 보여주고 방향을 확정한다.
6. 확정되면 `design-map.json`의 `screens.<key>.pencil`에 `이름 (노드id)`를 기록한다. 이 기록이 절차 B의 입력이다.

## 절차 B — 구현 전 대조 (매 UI 작업)

1. `design-map.json`에서 대상 화면·컴포넌트의 `pencil` 노드 id를 찾는다. `없음`이면 `DESIGN.md` 기준으로 구현하고 보고서에 **"Pencil 미대조"** 로 표시한다.
2. `execute`로 구조를 읽는다. **프레임 자신의 `fill`·`layout`·크기까지 읽는다**(자식만 읽고 프레임 배경을 놓친 전례가 있다):
   ```js
   Print(Get("<id>", {depth: 2}))
   Get("<id>", (n, c) => Print(n.id, "|", n.name, "|", n.type, "|", Math.round(c.bounds.x), Math.round(c.bounds.y), Math.round(c.bounds.width), Math.round(c.bounds.height), "|", JSON.stringify(n.fill ?? "")))
   TakeScreenshot(["<id>"])
   ```
3. 색은 `$변수` 이름을 그대로 시맨틱 토큰 클래스로 옮긴다(`$primary` → `bg-primary`, `$muted-foreground` → `text-muted-foreground`). 크기는 `$size-*`·`$radius-*` → `h-button-lg`·`rounded-lg`. 텍스트 크기·가중치는 `DESIGN.md` 3장 표로 타이포 토큰(`text-h1` …)에 대응시킨다.
4. Pencil 값이 `tokens.json`에 없는 값이면 **변수 추가 → 절차 C** 순으로 처리하고, 그 전까지는 가장 가까운 토큰으로 구현하며 보고서에 적는다.
5. 구현 후 웹(`pnpm web`)이나 시뮬레이터 스크린샷을 Pencil 스크린샷과 나란히 놓고 배경·헤더·탭바·간격을 대조한다.
6. 보고서에 참조한 Pencil 노드(`이름 (id)`)와 `tokens:check` 결과를 적는다.

## 절차 C — 토큰 동기화 (Pencil 변수 → tokens.json)

1. Pencil에서 변수를 바꾼다(`SetVariables({...})`, 테마 값은 light/dark 배열). 사용자가 Pencil 앱에서 직접 바꿔도 된다.
2. Pencil이 디스크에 저장했는지 확인한다(변수 변경은 저장이 늦을 수 있다 — `node -e 'console.log(JSON.parse(require("fs").readFileSync("design.pen","utf8")).variables["<이름>"])'`). 저장 안 됐으면 사용자에게 ⌘S를 요청한다.
3. `pnpm tokens:sync` — `scripts/sync-pen-tokens.cjs`가 `design.pen` 변수를 `tokens.json`에 반영(같은 hex의 프리미티브가 있으면 참조로)하고 `$source.pencilSyncedAt`을 갱신한 뒤, `sync-tokens.cjs`가 `tailwind.config.js`·`global.css`·`lib/theme.ts`를 재생성한다.
4. `pnpm tokens:check`, `pnpm typecheck` — 사라진 토큰을 참조하는 코드가 있으면 목록을 보고하고 승인 후 수정한다.
5. `tokens:check`(훅·CI)는 `design.pen`과 `tokens.json`이 다르면 실패한다. `tokens.json`을 손으로 고쳐 맞추지 말고 Pencil을 고친다.

## 금지

- `tokens.json`, `tailwind.config.js`, `global.css`, `lib/theme.ts`를 직접 편집하지 않는다(원천은 Pencil, 생성은 스크립트).
- 대조 없이 "Pencil대로 구현했다"고 보고하지 않는다. 노드 id와 스크린샷 없이는 "미대조"다.
- Pencil MCP가 응답하지 않는 상태에서 그리거나 대조한 것처럼 보고하지 않는다.
- Figma를 코드 구현·대조의 근거로 쓰지 않는다. Figma 프레임은 `pnpm figma:build` 출력물이다.

## 보고 형식

```
Pencil 대조 보고
- 노드: <이름> (<id>) / 스크린샷: 확인 · 미확인
- 토큰: 추가 요청 <목록> · 가장 가까운 토큰으로 대체 <목록>
- 검증: tokens:check <결과>, typecheck <결과>
- 미대조 항목: <목록 또는 없음>
```
