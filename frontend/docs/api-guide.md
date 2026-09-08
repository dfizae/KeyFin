# KeyFin API 통신 가이드

서버 통신 코드를 쓸 때 반드시 이 가이드를 따른다. **무엇을 주고받는지**(엔드포인트·DTO·열거형)는 [`docs/api-contract.md`](./api-contract.md), **규칙**은 `.agents/rules/20-api-data.md`(호출 계층·Query)와 `.agents/rules/90-backend-contract.md`(계약)에 있다. 이 문서는 그것을 **코드로 옮기는 절차와 예시**다.

## 1. 아키텍처

```
app/ 화면 ──▶ features/<domain>/api/queries.ts ──▶ features/<domain>/api/<domain>.api.ts ──▶ api/client.ts ──▶ https://…/api/v1
             (xxxKeys · queryOptions · 훅)         (엔드포인트 1:1 함수, 목 분기)              (axios · 인터셉터 · ApiError)
                                                          │
                                                          ▼
                                             features/<domain>/model.ts  (DTO → 화면 모델, ContractMismatchError)
```

| 계층 | 위치 | 책임 | 금지 |
| --- | --- | --- | --- |
| 통신 | `api/client.ts` | axios 인스턴스(`baseURL`, 타임아웃 상수), 요청 인터셉터(`Authorization`), 응답 인터셉터(401 갱신 단일 실행, `ApiError` 정규화) | 도메인 함수 밖에서 `api` import |
| 도메인 API | `features/<domain>/api/<domain>.api.ts` | 엔드포인트 1:1 함수. 인자는 도메인 타입, 안에서 path·params·body 매핑. `USE_MOCKS` 분기 | TanStack Query import, 헤더 조립 |
| 화면 모델 | `features/<domain>/model.ts` | DTO 타입(계약 사본과 1:1) + `toXxx` 변환 + 계약 검증 | UI 문구, 포맷팅 이외의 로직 |
| 서버 상태 | `features/<domain>/api/queries.ts` | `<domain>Keys` 팩토리, `queryOptions` 팩토리, `useXxx` 훅, 뮤테이션 훅과 무효화 | axios·fetcher 직접 호출 |
| 오류 문구 | `features/<domain>/errors.ts` | `code` → 사용자 문구 | 서버 `message` 를 가공해 분기 |
| 목 데이터 | `api/mocks/<domain>.ts` | 계약 사본의 응답 예시를 그대로 옮긴 값 | 실제 계좌·개인 정보 |
| UI | `app/`, `features/<domain>/components/` | 훅 사용, `isPending`/`isError` 분기 | `api/`·도메인 함수 직접 import |

방방봐(웹) 가이드와 다른 점: `src/api`·`src/hooks/queries` 로 나누지 않고 **도메인 폴더 안에** api 가 들어간다. 백엔드 응답에 `success`/`data` 봉투가 **없으므로** 벗기는 코드도 없다. 서버 `message` 는 사용자 문구로 쓸 수 있다(§7).

## 2. 도메인 폴더 ↔ API 도메인

| `features/` | API 도메인 | 엔드포인트 | 비고 |
| --- | --- | --- | --- |
| `auth` | AUTH | signup · login · refresh · logout · password | 토큰 보관(`expo-secure-store`)과 로그아웃 시 초기화도 여기 |
| `settings` | USER | `/settings`(이체 동의·한도), `/settings/notifications`, 코치 말투, `/users/me`, `/profile` | |
| `link` | LINK | `/links/candidates`, `/links`, 해제 | 온보딩 연결 화면 |
| `account` | ACCOUNT | `/accounts`, `/accounts/{id}/income` | 기존 `AccountSummaryDto` 는 계약 사본의 `AccountList.items[]` 로 교체 |
| `transaction` | TRANSACTION | `/transactions`, `/transactions/pending`, 분류 확정, `/subcategories` | 세분류 22종 상수·봉투 색은 `transaction/catalog.ts` |
| `budget` | BUDGET | proposals · `/budgets/{month}` · confirm · emergency · `/reports/{month}` | 리포트도 여기 |
| `payment` | PAYMENT | `/payments/calendar`, `/fixed-expenses`, `/transfers` | 이체 승인·나중에·재시도 |
| `room` | GAME(방) | `/room`, `/attendance`, `/room/stickers/remove`, `/items/{id}/equip`, `/themes` | 씬 렌더링 코드가 이미 있는 폴더. `home/api/home.api.ts` 의 `/home/summary` 는 `/room` 으로 교체 |
| `shop` | GAME(상점) | `/shop`, `/shop/purchase`, `/coins` | |
| `notification` | NOTIFICATION | `/devices`, `/notifications`, 읽음 처리 | FCM 토큰 등록은 로그인 직후 |
| `coaching` | COACHING | `/coaching/chat`, 추천 | |

폴더가 없으면 위 이름으로 만든다. 한 엔드포인트를 두 폴더에서 호출하지 않는다.

## 3. 공통 규약을 코드로

### 3-1. `api/client.ts` 가 책임지는 것

```ts
// api/client.ts — 목표 형태 (인터셉터·ApiError 는 아직 없음, 도입 시 이 모양으로)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? ""; // 호스트만. 비어 있으면 목 모드
export const TIMEOUT_QUERY_MS = 10_000;  // 조회
export const TIMEOUT_MONEY_MS = 30_000;  // 이체 승인·재시도·구매

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: TIMEOUT_QUERY_MS,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

// 요청: SecureStore 의 accessToken 을 Authorization: Bearer 로. /auth/signup·login·refresh 는 제외.
// 응답: 401 → refresh 단일 실행(동시 401 은 같은 Promise 를 기다린다) → 원 요청 1회 재시도 → 실패 시 토큰 삭제 + 로그인 이동.
//       그 외 오류 → ApiError(status, code, message) 로 정규화. 네트워크 단절·타임아웃은 status 0, code "NETWORK" | "TIMEOUT".
```

- 도메인 함수는 경로만 쓴다: `api.get("/budgets/202609")`. `/api/v1` 을 붙이지 않는다.
- 성공 응답은 **봉투 없이 본문이 데이터**다. `const { data } = await api.get<BudgetDto>(...)` 로 끝. 빈 본문(`PUT /accounts/{id}/income` 등)은 `Promise<void>`.
- 헤더는 `client.ts` 인터셉터만 붙인다. KeyFin 계약에는 `Authorization` 외 공통 헤더가 없다. 특정 엔드포인트 전용 헤더가 생기면 그 도메인 함수 **안에서** `config.headers` 로 지정하고 호출부에 노출하지 않는다.
- 돈이 움직이는 요청은 함수 안에서 `{ timeout: TIMEOUT_MONEY_MS }` 를 넘긴다.

### 3-2. 타입 변환 규칙 (`model.ts`)

| 계약 값 | DTO 타입 | 화면 모델 | 변환 |
| --- | --- | --- | --- |
| 금액(원 정수, JSON number) | `number` | `KRW`(`lib/money.ts`, 문자열) | `Number.isSafeInteger(n)` 검증 후 `String(n)`. 실패 시 `ContractMismatchError` |
| `month` `"YYYYMM"` | `string` | `string` 그대로 | 화면 표시만 `2026년 9월` 로 |
| `txDate` + `txTime` | `string` × 2 | 표시 문자열 또는 `Date` | 합쳐서 `${txDate}T${txTime}+09:00` → `parseISODate` |
| `executedAt`·`createdAt`·`until`(시간대 없음, KST) | `string` | `Date` | `+09:00` 을 붙여 `parseISODate`. 헬퍼 `parseKSTLocal` 을 `lib/date.ts` 에 추가한다(TBD, 테스트 포함) |
| 열거형 | 문자열 유니온 | 유니온 + `"UNKNOWN"` | 목록 밖 값은 `UNKNOWN` 으로 흡수, 화면은 기본 표기 |
| `nextCursor` | `number \| null` | 그대로 | `useInfiniteQuery` 의 `getNextPageParam` |
| `null` 가능 필드(`total.*`, `alias`, `memo`) | `T \| null` | `T \| null` | `??` 로 기본값을 만들지 않는다(미승인 월 등 상태 의미가 있다) |

- 서버 파생값(`remaining`, `remainingRate`, `shortage`, `balance`)은 **검증만 하고 계산하지 않는다**.
- DTO 타입 이름은 계약 사본과 같게(`BudgetResponse` → `BudgetDto` 처럼 `Dto` 접미만). 두 도메인이 같이 쓰는 타입(`Transaction`)은 소유 도메인의 `model.ts` 에서 export.

## 4. 새 도메인 API 추가하는 법 — 예시: 예산·잔액 조회와 승인

### ① `features/budget/model.ts`

```ts
import { ContractMismatchError } from "@/lib/contract";
import type { KRW } from "@/lib/money";

export type BudgetStatus = "PROPOSED" | "CONFIRMED" | "UNKNOWN";

export type BudgetEnvelopeDto = {
  envelopeId: number; name: string; proposedAmount: number;
  confirmedAmount: number | null; spent: number | null; remaining: number | null; remainingRate: number | null;
};
export type BudgetDto = {
  month: string;
  status: string;
  total: { confirmed: number | null; spent: number | null; remaining: number | null; remainingRate: number | null };
  envelopes: BudgetEnvelopeDto[];
  emergency?: { amount: number; spent: number; remaining: number };
};

export type BudgetEnvelope = {
  envelopeId: number; name: string; proposed: KRW; confirmed: KRW | null; spent: KRW | null; remaining: KRW | null; remainingRate: number | null;
};
export type Budget = { month: string; status: BudgetStatus; isConfirmed: boolean; total: { confirmed: KRW; spent: KRW; remaining: KRW; remainingRate: number } | null; envelopes: BudgetEnvelope[] };

function won(value: number, field: string): KRW {
  if (!Number.isSafeInteger(value)) throw new ContractMismatchError(field);
  return String(value);
}
const toStatus = (raw: string): BudgetStatus => (raw === "PROPOSED" || raw === "CONFIRMED" ? raw : "UNKNOWN");

export function toBudget(dto: BudgetDto): Budget {
  const status = toStatus(dto.status);
  const t = dto.total;
  const total =
    t.confirmed === null || t.spent === null || t.remaining === null || t.remainingRate === null
      ? null
      : { confirmed: won(t.confirmed, "total.confirmed"), spent: won(t.spent, "total.spent"), remaining: won(t.remaining, "total.remaining"), remainingRate: t.remainingRate };
  return {
    month: dto.month,
    status,
    isConfirmed: status === "CONFIRMED",
    total,
    envelopes: dto.envelopes.map((e) => ({
      envelopeId: e.envelopeId,
      name: e.name,
      proposed: won(e.proposedAmount, "envelopes.proposedAmount"),
      confirmed: e.confirmedAmount === null ? null : won(e.confirmedAmount, "envelopes.confirmedAmount"),
      spent: e.spent === null ? null : won(e.spent, "envelopes.spent"),
      remaining: e.remaining === null ? null : won(e.remaining, "envelopes.remaining"),
      remainingRate: e.remainingRate,
    })),
  };
}
```

### ② `features/budget/api/budget.api.ts`

```ts
import { API_BASE_URL, api } from "@/api/client";
import { budgetMock, withMockLatency } from "@/api/mocks/budget";
import { toBudget, type Budget, type BudgetDto } from "@/features/budget/model";

export const USE_MOCKS = API_BASE_URL === "";

export async function getBudget(month: string, signal?: AbortSignal): Promise<Budget> {
  if (USE_MOCKS) return toBudget(await withMockLatency(budgetMock(month), signal));
  const { data } = await api.get<BudgetDto>(`/budgets/${month}`, { signal });
  return toBudget(data);
}

export type ConfirmBudgetInput = { month: string; envelopes: { envelopeId: number; amount: number }[] }; // 7개 전부

export async function confirmBudget({ month, envelopes }: ConfirmBudgetInput): Promise<void> {
  if (USE_MOCKS) { await withMockLatency(undefined); return; }
  await api.put(`/budgets/${month}/confirm`, { envelopes });
}
```

- 함수명은 동사로: `getXxx` / `createXxx` / `updateXxx` / `deleteXxx` / `confirmXxx` / `approveXxx`.
- 조회 함수의 마지막 인자는 `signal?: AbortSignal`(TanStack Query 가 취소에 쓴다).
- 호출부는 어떤 값이 path 로 가고 어떤 값이 body 로 가는지 몰라야 한다. 인자는 도메인 타입 하나.

### ③ `features/budget/api/queries.ts`

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { confirmBudget, getBudget, type ConfirmBudgetInput } from "@/features/budget/api/budget.api";
import { roomKeys } from "@/features/room/api/queries";

export const budgetKeys = {
  all: ["budget"] as const,
  month: (month: string) => [...budgetKeys.all, "month", month] as const,
  report: (month: string) => [...budgetKeys.all, "report", month] as const,
};

export const budgetQueryOptions = (month: string) =>
  queryOptions({ queryKey: budgetKeys.month(month), queryFn: ({ signal }) => getBudget(month, signal), staleTime: 30_000 });

export const useBudget = (month: string) => useQuery(budgetQueryOptions(month));

export function useConfirmBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmBudgetInput) => confirmBudget(input),
    onSuccess: (_, { month }) => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.month(month) });
      void queryClient.invalidateQueries({ queryKey: roomKeys.all }); // 벽 보드
    },
  });
}
```

### ④ 화면

```tsx
function BudgetBoard({ month }: { month: string }) {
  const { data, isPending, isError, refetch } = useBudget(month);
  if (isPending) return <Skeleton className="h-32" />;
  if (isError) return <EmptyState title="예산을 불러오지 못했어요" action={{ label: "다시 시도", onPress: () => void refetch() }} />;
  if (!data.isConfirmed) return <BudgetUnsetBanner month={month} />; // 승인 유도
  return <EnvelopeBars envelopes={data.envelopes} />;
}
```

## 5. 쿼리 키와 무효화 지도

키는 반드시 `<domain>Keys` 팩토리로만 만든다. 어떤 변경이 어떤 조회를 낡게 만드는지는 계약이 정한 것이므로 아래 표를 따른다. 표에 없는 조합이 필요하면 표부터 고친다.

| 뮤테이션 | 무효화(invalidate) | 즉시 반영(setQueryData) |
| --- | --- | --- |
| `POST /links`, `PUT /accounts/{id}/income`, `DELETE /links/*` | `linkKeys.all`, `accountKeys.all` | — |
| `POST /budgets/proposals`, `PUT /budgets/{month}/confirm`, `PUT …/emergency` | `budgetKeys.all`, `roomKeys.all` | — |
| `PUT /transactions/{id}/classification`, `PUT /transactions/classifications` | `transactionKeys.all`, `budgetKeys.month(month)`, `roomKeys.all` | 응답 `envelopeBalance.remaining` 을 `budgetKeys.month(month)` 캐시의 해당 봉투에 반영 |
| `POST/PUT/DELETE /fixed-expenses` | `paymentKeys.calendar()`, `transferKeys.all` | — |
| `POST /transfers/{id}/approve · postpone · retry` | `transferKeys.all`, `paymentKeys.calendar()`, `accountKeys.all`, `notificationKeys.all` | 응답 `status`·`executedAt` 을 해당 이체 캐시에 반영 |
| `POST /attendance` | `roomKeys.all`, `coinKeys.all` | 응답 `balance` 를 `roomKeys.home()` 의 `coin.balance` 에 반영 |
| `POST /shop/purchase` | `shopKeys.all`, `coinKeys.all`, `roomKeys.all` | 응답 `balance` |
| `PUT/DELETE /items/{id}/equip` | `roomKeys.all`, `shopKeys.all` | 낙관적 갱신 허용(§8) |
| `POST /room/stickers/remove` | `roomKeys.all` | 응답 `count` |
| `PUT /notifications/{id}/read`, `read-all` | `notificationKeys.all` | 낙관적 갱신 허용(§8) |
| `PUT /settings`, `PUT /settings/notifications` | `settingsKeys.all` | — |
| `POST /auth/login` | 전체 캐시 `queryClient.clear()` 후 시작 | — |
| `POST /auth/logout`, `DELETE /users/me` | `queryClient.clear()`, SecureStore 토큰 삭제 | — |

## 6. 커서 페이지네이션

거래·코인·알림 목록은 `useInfiniteQuery` 로 붙인다. 커서는 **마지막 조회 id**, 응답 `nextCursor` 가 `null` 이면 끝.

```ts
export const transactionListInfiniteOptions = (filters: TransactionFilters) =>
  infiniteQueryOptions({
    queryKey: transactionKeys.list(filters),           // 필터 전부가 키에 들어간다
    queryFn: ({ pageParam, signal }) => getTransactions({ ...filters, cursor: pageParam ?? undefined }, signal),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,       // null 이면 hasNextPage=false
  });
```

`size` 는 기본 20 을 쓰고 화면이 바꾸지 않는다. 목록 합계를 화면에서 더해 보여주지 않는다(봉투 합계는 서버 값).

## 7. 에러 처리

- 모든 통신 실패는 `ApiError(status, code, message)` 로 정규화된다(`api/client.ts`, 도입 시 `api/error.ts` 로 분리).
  - `status`: HTTP 상태. 네트워크 단절·타임아웃은 `0`.
  - `code`: 서버 `{ code }`. 확인된 값은 `ERR_LOGIN_FAIL` 뿐이고 나머지는 공통 401/403/404/409(계약 사본 §1).
  - `message`: 서버가 사용자 문구로 변환한 값(금융망 오류 포함).
- 분기는 `isApiError(error)` 타입 가드 → `error.code` 로. 문구는 `features/<domain>/errors.ts` 에서 `code` 별로 정의하고, 정의가 없으면 서버 `message` 를, 그것도 없으면 도메인 기본 문구를 쓴다. `status` 로만 분기하지 않는다(같은 409 라도 도메인마다 뜻이 다르다).
- 쿼리: 컴포넌트는 `isPending`/`isError`/`error` 만 보고 재시도 가능한 폴백 UI 를 렌더한다.
- 뮤테이션 + 폼: 로컬 오류 상태에 문구를 넣어 인라인으로 보여주고, 사용자 입력값은 유지한다.

```tsx
const { mutateAsync, isPending } = useConfirmBudget();
const [error, setError] = useState<string | null>(null);

async function onSubmit() {
  setError(null);
  try {
    await mutateAsync({ month, envelopes });
    router.replace("/character/moving-in");
  } catch (e) {
    setError(isApiError(e) ? (budgetErrorMessage[e.code] ?? e.message) : "예산을 저장하지 못했어요. 다시 시도해 주세요.");
  }
}
```

- 재시도 정책은 `lib/query-client.ts` 전역: 쿼리 1회, 뮤테이션 0회. 4xx 는 재시도하지 않도록 `retry` 함수에서 `ApiError.status` 를 본다(도입 시).
- 401 은 인터셉터가 처리하므로 화면에서 다루지 않는다. 403 은 재시도하지 않는다. 409 는 계약 사본의 뜻대로(중복 이메일·이미 연결 등) 문구를 보여준다.
- `console.log` 로 오류를 흘리지 않는다. 디버깅은 React Query Devtools.

## 8. 낙관적 업데이트

서버 캐시 안에 사는 값의 선반영은 TanStack Query 캐시 계층에서 한다(`onMutate` 스냅샷 → `onError` 롤백 → `onSettled` 무효화).

- **허용**: 아이템 장착·해제, 알림 읽음 처리처럼 실패해도 돈·잔액에 영향이 없는 토글.
- **금지**: 이체 승인·재시도, 상점 구매, 출석, 분류 확정, 예산 승인. 이것들은 서버가 계산한 응답(`balance`, `envelopeBalance`, `status`)을 받은 뒤 `setQueryData` 로 반영한다.

```ts
export function useEquipItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userItemId: number) => equipItem(userItemId),
    onMutate: async (userItemId) => {
      await queryClient.cancelQueries({ queryKey: roomKeys.home() });
      const previous = queryClient.getQueryData<Room>(roomKeys.home());
      queryClient.setQueryData<Room>(roomKeys.home(), (old) => (old ? applyEquip(old, userItemId) : old));
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(roomKeys.home(), ctx.previous); },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}
```

## 9. 목 데이터

- `EXPO_PUBLIC_API_URL` 이 비어 있으면 `USE_MOCKS` 가 켜지고 도메인 함수가 `api/mocks/<domain>.ts` 값을 돌려준다. 백엔드 55개 엔드포인트가 모두 "시작 전"이므로 당분간 기본 모드다.
- 목 값은 **계약 사본의 응답 예시를 그대로** 옮긴다(`"메가커피 역삼점"`, `4500`, `"2026-09-08"` …). 필드를 더하거나 빼지 않는다. 계약이 바뀌면 목과 `model.ts` 를 같이 고친다.
- 실제 계좌번호·카드번호·개인 정보를 넣지 않는다. 예시의 더미 값만 쓴다.
- 지연은 `withMockLatency`(400ms)로 흉내 내고 `signal` 취소를 지원한다. 오류 시나리오(401·409·네트워크)는 목 함수에 옵션으로 두어 폴백 UI 를 확인한다.

## 10. 금지 사항

- 컴포넌트·라우트에서 `api/` 인스턴스나 도메인 함수 직접 호출 금지 — 항상 `features/<domain>/api/queries.ts` 의 훅 경유.
- `api/client.ts` 의 인스턴스를 인터셉터 없이 새로 만들지 않는다(인증·오류 정규화 우회 방지).
- 쿼리 키 문자열 하드코딩 금지 — `<domain>Keys` 팩토리만.
- `useEffect` + `useState` 로 서버 데이터 보관 금지 — 서버 상태는 TanStack Query 가 소유. 편집 중인 사본(예산 슬라이더, 방 배치 draft)만 Zustand·로컬 상태.
- 잔액·잔여율·부족액·코인 잔액을 클라이언트에서 계산해 표시 금지.
- 계약 사본에 없는 엔드포인트·필드·열거형 값을 가정해 코드에 넣지 않는다. 필요하면 백엔드에 요청하고 보고서에 `TBD`.
- 스펙과 실제 응답이 다르면 `model.ts` 에서 우회하지 않고 `ContractMismatchError` 로 드러내고 보고한다.

## 11. 미확정 (TBD)

- `api/client.ts` 인터셉터·`ApiError`·refresh 단일 실행: 계약은 확정됐으나 코드 미구현. 백엔드 첫 엔드포인트가 열릴 때 함께 넣는다.
- 토큰 보관: `expo-secure-store` 키 이름(`keyfin.accessToken`, `keyfin.refreshToken`)과 `features/auth/store.ts`(로그인 상태) 도입.
- `lib/date.ts` 의 `parseKSTLocal`(시간대 없는 서버 시각 파싱)과 `lib/money.ts` 에 `fromServerWon(number)` 헬퍼 추가 여부.
- `GET /home/summary`(임시 계약) → `GET /room` + `GET /budgets/{month}` 교체와 `features/home/model.ts` 의 70% 임계값 제거.
- 방 가구 배치 저장 API(`PUT /room/layout` 요청 vs 슬롯 기반)와 `PUT /fixed-expenses/{id}`·`DELETE …/equip` 등 상세 미확인 엔드포인트의 요청 형태.
- OpenAPI(springdoc) 제공 시 `openapi/openapi.yaml` + `api/generated/` 로 전환하고 `docs/api-contract.md` 삭제.
