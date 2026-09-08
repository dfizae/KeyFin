# KeyFin API 계약 사본

> **원천**: 팀 Notion [API 명세서](https://app.notion.com/p/API-036f938dd4cd82a9990b81e44d571c24)(2026-09-08 09:57 편집분) 와 [ERD v0.1](https://app.notion.com/p/ERD-033f938dd4cd820bbdd0812e6ee6f389). 백엔드가 OpenAPI(springdoc `/v3/api-docs`)를 내보내기 전까지 이 파일이 `.agents/rules/90-backend-contract.md` 가 말하는 "클라이언트 저장소의 스펙 사본"이다. OpenAPI 가 생기면 `openapi/openapi.yaml` 로 교체하고 이 파일은 삭제한다.
> 2026-09-08 기준 백엔드 55개 엔드포인트 전부 "시작 전". 아래 응답 형태는 명세이지 실제 서버 응답이 아니므로, 구현 후 다르면 클라이언트에서 우회하지 말고 불일치를 보고한다.
> **상세 미확인** 표시는 Notion 행 페이지를 아직 읽지 않은 것이고, **URL 미확인** 은 목록에 URL 이 비어 있는 것이다.

## 1. 공통 규약

| 항목 | 값 | 출처 |
| --- | --- | --- |
| Base path | `/api/v1` (호스트는 `EXPO_PUBLIC_API_URL`) | API 명세서 URL 열 |
| 인증 | `Authorization: Bearer <accessToken>`. Access 30분, Refresh 14일(Redis). AUTH 3개(signup·login·refresh)를 제외한 모든 API 필수 | 기능 명세서 §0 |
| 토큰 갱신 | `POST /auth/refresh` body `{ refreshToken }` → `{ accessToken }`. 401 이면 1회 갱신 후 재시도, 갱신 실패 시 로그인 화면 | API 명세서 · 규칙 90 |
| 성공 응답 | **봉투 없음**. 본문이 곧 데이터. 바디 없는 성공은 `200`/`201` 에 빈 본문 | 모든 행 페이지의 응답 예시 |
| 오류 응답 | `{ code: string, message: string }` + HTTP 상태. `message` 는 백엔드가 사용자 문구로 변환해 준 값(금융망 오류 포함). 확인된 `code`: `ERR_LOGIN_FAIL`(401). 공통: 401 토큰 만료 · 403 권한 · 404 없음 · 409 충돌(중복 이메일 등) | 기능 명세서 §0 · 로그인 행 |
| 명명 | camelCase. Path Variable `{id}`, 조회 조건은 Query Parameter, 변경은 JSON body | 전 행 |
| 금액 | **원 단위 정수, JSON number(Long)**. 소수·문자열 아님 | 전 행 (`balance: 1500000`) |
| 날짜·시각 | `month` `"YYYYMM"` · 날짜 `"YYYY-MM-DD"` · 시각 `"HH:mm:ss"` · 일시 `"YYYY-MM-DDTHH:mm:ss"`(**시간대 없음, KST 로컬**) | 전 행 |
| 페이지네이션 | 커서. 요청 `cursor`(마지막 조회 id, Long) + `size`(기본 20). 응답 `{ items: T[], nextCursor: number \| null }`, 마지막 페이지는 `null` | 거래·코인·알림 |
| 멱등성 | 이체 승인·재시도는 서버가 기관거래고유번호로 보장(H1007 = 이미 성공). 연결(`POST /links`)은 이미 연결된 항목 무시. 출석·코인은 `uq_coin_grant` 로 중복 차단 | 기능 명세서 |
| 시간대 | 서버는 KST. 응답의 시각 문자열에 오프셋이 없으므로 `lib/date.ts` 의 `parseISODate` 는 그대로 못 쓴다(§5 참고) | — |

## 2. 엔드포인트 목록 (55)

우선순위 P0 = MVP. 담당은 백엔드 담당자.

| 도메인 | Use Case | Method | URL | P | 담당 |
| --- | --- | --- | --- | --- | --- |
| AUTH | 회원가입 | POST | `/auth/signup` | P0 | 고예린 |
| AUTH | 로그인 | POST | `/auth/login` | P0 | 고예린 |
| AUTH | 토큰 재발급 | POST | `/auth/refresh` | P0 | 고예린 |
| AUTH | 로그아웃 | POST | `/auth/logout` | P1 | 고예린 |
| AUTH | 비밀번호 변경 | PUT | `/auth/password` | P1 | 고예린 |
| USER | 이체 설정 조회 | GET | `/settings` | P0 | 고예린 |
| USER | 이체 설정 변경 | PUT | `/settings` | P0 | 고예린 |
| USER | 회원 탈퇴 | DELETE | `/users/me` | P1 | 고예린 |
| USER | 프로필 입력 | PUT | `/profile` | P2 | 고예린 |
| LINK | 금융망 계좌·카드 목록 | GET | `/links/candidates` | P0 | 고예린 |
| LINK | 선택 항목 연결 | POST | `/links` | P0 | 고예린 |
| LINK | 계좌 연결 해제 | DELETE | `/links/accounts/{id}` | P1 | 고예린 |
| LINK | 카드 연결 해제 | DELETE | `/links/cards/{id}` | P1 | 고예린 |
| ACCOUNT | 내 연결 계좌 목록 | GET | `/accounts` | P0 | 고예린 |
| ACCOUNT | 수입 계좌 지정 | PUT | `/accounts/{id}/income` | P0 | 고예린 |
| TRANSACTION | 거래 내역 조회 | GET | `/transactions` | P0 | 고예린 |
| TRANSACTION | 미확정 거래 목록 | GET | `/transactions/pending` | P0 | 고예린 |
| TRANSACTION | 거래 분류 확정·수정 | PUT | `/transactions/{id}/classification` | P0 | 고예린 |
| TRANSACTION | 세분류 목록 | GET | `/subcategories` | P0 | 고예린 |
| TRANSACTION | 거래 일괄 분류 확정 | PUT | `/transactions/classifications` | P1 | 고예린 |
| TRANSACTION | 거래 메모 | PUT | `/transactions/{id}/memo` | P2 | 고예린 |
| BUDGET | 예산 제안 생성 | POST | `/budgets/proposals` | P0 | 정재원 |
| BUDGET | 예산·잔액 조회 | GET | `/budgets/{month}` | P0 | 정재원 |
| BUDGET | 예산 승인·조정 | PUT | `/budgets/{month}/confirm` | P0 | 정재원 |
| BUDGET | 월간 소비 리포트 | GET | `/reports/{month}` | P1 | 정재원 |
| BUDGET | 비상금 설정 | PUT | `/budgets/{month}/emergency` | P1 | 정재원 |
| BUDGET | 절감 포인트 조회 | GET | `/savings/insights` | P2 | 정재원 |
| PAYMENT | 결제 통합 일정 | GET | `/payments/calendar` | P0 | 정재원 |
| PAYMENT | 고정지출 등록 | POST | `/fixed-expenses` | P0 | 정재원 |
| PAYMENT | 고정지출 수정 | PUT | `/fixed-expenses/{id}` | P0 | 정재원 |
| PAYMENT | 고정지출 삭제 | DELETE | `/fixed-expenses/{id}` | P0 | 정재원 |
| PAYMENT | 이체 제안·이력 조회 | GET | `/transfers` | P0 | 정재원 |
| PAYMENT | 이체 승인·실행 | POST | `/transfers/{id}/approve` | P0 | 정재원 |
| PAYMENT | 이체 나중에 하기 | POST | `/transfers/{id}/postpone` | P0 | 정재원 |
| PAYMENT | 이체 재시도 | POST | `/transfers/{id}/retry` | P1 | 정재원 |
| PAYMENT | 카드 청구 내역·예정액 | GET | `/cards/{id}/billings` | P1 | 정재원 |
| GAME | 방 홈 데이터 | GET | `/room` | P0 | 윤현준 |
| GAME | 출석 | POST | `/attendance` | P0 | 윤현준 |
| GAME | 상점 목록 | GET | `/shop` | P1 | 윤현준 |
| GAME | 상점 아이템 구매 | POST | `/shop/purchase` | P1 | 윤현준 |
| GAME | 코인 잔액·이력 | GET | `/coins` | P1 | 윤현준 |
| GAME | 아이템 장착 | PUT | `/items/{userItemId}/equip` | P1 | 윤현준 |
| GAME | 아이템 장착 해제 | DELETE | `/items/{userItemId}/equip` | P1 | 윤현준 |
| GAME | 압류 딱지 제거 | POST | `/room/stickers/remove` | P1 | 윤현준 |
| GAME | 방 테마 목록 | GET | `/themes` | P2 | 윤현준 |
| GAME | 방 테마 변경 | PUT | `/room/theme` | P2 | 윤현준 |
| NOTIFICATION | FCM 토큰 등록·갱신 | POST | `/devices` | P0 | 윤현준 |
| NOTIFICATION | 알림함 조회 | GET | `/notifications` | P1 | 윤현준 |
| NOTIFICATION | 알림 읽음 처리 | PUT | `/notifications/{id}/read` | P1 | 윤현준 |
| NOTIFICATION | 알림 전체 읽음 처리 | PUT | `/notifications/read-all` | P1 | 윤현준 |
| NOTIFICATION | 알림 설정 변경 | PUT | `/settings/notifications` | P1 | 윤현준 |
| COACHING | 코칭 대화 | POST | `/coaching/chat` | P1 | 윤현준 |
| COACHING | 코치 말투 선택 | PUT | URL 미확인 | P1 | 윤현준 |
| COACHING | 지원 정책 추천 | GET | URL 미확인 | P2 | 윤현준 |
| COACHING | 금융 상품 추천 | GET | URL 미확인 | P2 | 윤현준 |

## 3. 엔드포인트 상세

타입은 TypeScript 표기. `?` 는 선택(응답에서는 조건부로 오거나 `null`). 열거형 값은 §4.

### AUTH

```ts
// POST /auth/signup — 201. 금융망 member 생성 + 기본 아이템 3종 지급·장착까지 한 트랜잭션, 실패 시 전체 롤백
type SignupRequest = { email: string; password: string; name: string };
type SignupResponse = { userId: number };
// 409 중복 이메일. 탈퇴 계정 이메일 재사용 불가("탈퇴한 계정입니다")

// POST /auth/login — 200
type LoginRequest = { email: string; password: string };
type LoginResponse = { accessToken: string; refreshToken: string; user: { id: number; name: string } };
// 401 ERR_LOGIN_FAIL — 탈퇴 계정도 같은 응답(사유 비노출)

// POST /auth/refresh — 200
type RefreshRequest = { refreshToken: string };
type RefreshResponse = { accessToken: string };

// POST /auth/logout, PUT /auth/password — 상세 미확인
```

### USER

```ts
// GET /settings — 200 (FR-PAY-04 입력값). 요청 바디·파라미터 없음
type TransferSettings = { transferConsent: boolean; transferLimitOnce: number; transferLimitDaily: number };

// PUT /settings — 200. 요청·응답 모두 TransferSettings

// DELETE /users/me, PUT /profile — 상세 미확인
```

### LINK

```ts
// GET /links/candidates — 200 (FR-USR-02). 금융망 기준 연결 가능 목록
type LinkCandidates = {
  accounts: { finAccountNo: string; bankCode: string; bankName: string; balance: number; linked: boolean }[];
  cards: { cardNo: string; issuerName: string; cardName: string; withdrawalAccountNo: string; linked: boolean }[];
};

// POST /links — 201. 이미 연결된 항목은 무시(멱등)
type LinkRequest = { accounts: string[]; cards: string[] }; // finAccountNo · cardNo 목록
type LinkResponse = { accounts: number; cards: number };    // 새로 연결된 수

// DELETE /links/accounts/{id}, DELETE /links/cards/{id} — 상세 미확인
```

### ACCOUNT

```ts
// GET /accounts — 200
type AccountList = {
  items: {
    id: number; finAccountNo: string; bankName: string; alias: string | null;
    isIncome: boolean; isManaged: boolean; balance: number;
  }[];
};

// PUT /accounts/{id}/income — 200, 본문 없음. 사용자당 1개, 기존 수입 계좌는 자동 해제
```

### TRANSACTION

```ts
type Transaction = {
  id: number;
  txType: TxType;                 // CARD | DEPOSIT | WITHDRAW | TRANSFER
  merchantName: string;
  amount: number;                 // 원
  txDate: string;                 // "2026-09-08"
  txTime: string;                 // "14:21:00"
  envelopeId: number;             // 1..7
  subcategoryId: number;          // 101..703
  subcategoryName: string;
  confirmStatus: ConfirmStatus;   // AUTO | PENDING | CONFIRMED
  excludeTag: ExcludeTag;         // NONE | DUTCH | SELF_TRANSFER | EMERGENCY | CARRYOVER
  status: TxStatus;               // NORMAL | CANCELED
};

// GET /transactions — 200 (FR-TXN-09). 커서 페이지. CANCELED·제외 태그 거래도 반환(뱃지 표시는 FE)
type TransactionListQuery = {
  month: string;            // 필수 "YYYYMM"
  envelopeId?: number; subcategoryId?: number; accountId?: number; cardId?: number;
  cursor?: number;          // 마지막 조회 거래 id
  size?: number;            // 기본 20
};
type TransactionListResponse = { items: (Transaction & { memo: string | null })[]; nextCursor: number | null };

// GET /transactions/pending — 200. 파라미터 없음. 질문·정리 화면용 PENDING 만
type PendingTransactionsResponse = { items: Transaction[]; nextCursor: number | null };

// PUT /transactions/{id}/classification — 200 (FR-TXN-03). 둘 중 하나만 보낸다
type ClassifyRequest = { subcategoryId: number } | { excludeTag: "DUTCH" | "SELF_TRANSFER" | "EMERGENCY" };
type ClassifyResponse = { confirmStatus: ConfirmStatus; envelopeBalance: { envelopeId: number; remaining: number } };
// EMERGENCY 는 봉투 대신 당월 비상금 풀에서 차감

// GET /subcategories — 200. 정적 22종
type SubcategoryList = { items: { id: number; name: string; envelopeId: number; envelopeName: string }[] };

// PUT /transactions/classifications(P1), PUT /transactions/{id}/memo(P2) — 상세 미확인
```

### BUDGET

```ts
// POST /budgets/proposals — 201 (FR-USR-04, FR-BGT-01). 이력 없으면 basis=기본 템플릿 폴백
type ProposalRequest = { month: string }; // "202609"
type ProposalResponse = {
  budgetId: number; month: string; status: BudgetStatus; basis: string;
  envelopes: { envelopeId: number; name: string; proposedAmount: number; monthlyAvg: number; adjustment?: number }[];
};

// GET /budgets/{month} — 200 (FR-BGT-03·04). 잔액은 조회 시 계산. 미승인 월은 status=PROPOSED 이고 total·잔액 필드 null
type BudgetResponse = {
  month: string;
  status: BudgetStatus; // PROPOSED | CONFIRMED
  total: { confirmed: number | null; spent: number | null; remaining: number | null; remainingRate: number | null };
  envelopes: {
    envelopeId: number; name: string; proposedAmount: number;
    confirmedAmount: number | null; spent: number | null; remaining: number | null; remainingRate: number | null; // 정수 %
  }[];
  emergency?: { amount: number; spent: number; remaining: number }; // P1 비상금 설정 후
};

// PUT /budgets/{month}/confirm — 200 (FR-BGT-02). 봉투 7개 전부 전송
type ConfirmBudgetRequest = { envelopes: { envelopeId: number; amount: number }[] };
type ConfirmBudgetResponse = { status: "CONFIRMED" };

// GET /reports/{month} — 200 (FR-BGT-07). 예산 확정 전 월은 404. 시딩된 과거 3개월도 조회 가능
type ReportResponse = {
  month: string;
  total: { confirmed: number; spent: number; overAmount: number };
  envelopes: { envelopeId: number; name: string; proposedAmount: number; confirmedAmount: number; spent: number; overAmount: number; prevMonthSpent: number }[];
  topSubcategories: { subcategoryId: number; name: string; spent: number; count: number }[];
};

// PUT /budgets/{month}/emergency(P1), GET /savings/insights(P2) — 상세 미확인
```

### PAYMENT

```ts
// GET /payments/calendar?month=YYYYMM — 200 (FR-PAY-01·02). estimated=true 는 발행 전 카드 청구 예정액
type CalendarResponse = {
  days: {
    date: string; // "2026-09-15"
    items: {
      type: "FIXED" | "CARD_BILL";
      fixedExpenseId?: number; cardId?: number;
      name: string; amount: number;
      withdrawalAccountId?: number;
      estimated?: boolean;
      prepared: boolean;   // 결제 준비 여부
      shortage: number;    // 부족 금액(0 이면 준비됨)
    }[];
  }[];
};

// POST /fixed-expenses — 201 (FR-PAY-07)
type FixedExpenseRequest = {
  name: string; expenseType: ExpenseType; amount: number; paymentDay: number; // 1..31
  withdrawalAccountId: number; isVariable?: boolean; // 공과금(UTILITY)은 true
};
type FixedExpenseResponse = { id: number };
// PUT /fixed-expenses/{id}, DELETE /fixed-expenses/{id} — P0 이지만 상세 미확인(요청 형태는 POST 와 같다고 가정하지 말 것)

// GET /transfers?status=&month= — 200 (FR-PAY-03·08). status 예: PROPOSED, EXECUTED
type TransferListResponse = {
  items: {
    id: number; status: TransferStatus; scheduledDate: string; requiredAmount: number;
    fromAccountId: number; toAccountId: number;
    executedAt?: string;  // 실행된 이체만 "2026-09-14T07:12:00"
    failReason?: string;  // 실패한 이체만
    purpose: { type: string; name: string }; // 예: { type: "FIXED", name: "월세" }
  }[];
};

// POST /transfers/{id}/approve — 200. 실행 직전 동의→1회 한도→1일 한도→계좌 자격 순 검사
type ApproveTransferResponse = { status: "EXECUTED"; executedAt: string };
// POST /transfers/{id}/postpone — 200 본문 없음. PROPOSED 유지
// POST /transfers/{id}/retry(P1), GET /cards/{id}/billings(P1) — 상세 미확인
```

### GAME

```ts
// GET /room — 200 (FR-GAM-01). 응답 예시 미기재(명세 표만 있음)
type RoomResponse = {
  theme: string;
  avatar: {
    equipped: { slotType: SlotType; itemId: number; assetKey: string }[];
    reaction: { type: string; until: string } | null; // 진행 중 반응 없으면 null. type 값 목록 미확정
  };
  coin: { balance: number };
  board: { month: string; totalRemainingRate: number };
  attendance: { checkedToday: boolean };
  stickers?: { count: number; total: number; removableToday: boolean }; // P1
  overEnvelopes?: number[]; // P1 초과 봉투 id
};

// POST /attendance — 200 (FR-GAM-03). 당일 이미 출석이면 granted=0
type AttendanceResponse = { granted: number; balance: number };

// GET /shop?slotType= — 200 (FR-GAM-05)
type ShopResponse = { items: { id: number; name: string; slotType: SlotType; price: number; assetKey: string; themeCode: string; owned: boolean }[] };

// POST /shop/purchase — 200. 코인 원장 잠금 후 잔액 ≥ 가격 검증
type PurchaseRequest = { itemId: number };
type PurchaseResponse = { userItemId: number; balance: number };

// GET /coins?cursor=&size= — 200 (FR-GAM-08)
type CoinResponse = {
  balance: number;
  items: { id: number; delta: number; balanceAfter: number; reasonCode: CoinReason; reasonText: string; grantDate: string }[];
  nextCursor: number | null;
};

// PUT /items/{userItemId}/equip — 200 본문 없음. 같은 슬롯 기존 아이템 자동 해제
// DELETE /items/{userItemId}/equip — 상세 미확인

// POST /room/stickers/remove — 200 (FR-GAM-06). 하루 1개
type RemoveStickerResponse = { removed: number; count: number };

// GET /themes, PUT /room/theme — P2, 상세 미확인
```

### NOTIFICATION

```ts
// POST /devices — 200 본문 없음 (FR-NTF-01). 로그인 시 호출. 앱은 FCM data.type 으로 딥링크 라우팅(값 목록 미확인)
type DeviceRequest = { fcmToken: string };

// GET /notifications?unreadOnly=&cursor=&size= — 200 (FR-NTF-02)
type NotificationResponse = {
  items: {
    id: number; notiType: NotiType; title: string; body: string;
    refId: string | null;      // 이동 대상 id (이체 id, 거래 id 등)
    requiresAction: boolean;   // 미처리 건
    isRead: boolean; createdAt: string; // "2026-09-14T07:00:00"
  }[];
  nextCursor: number | null;
};

// PUT /notifications/{id}/read, PUT /notifications/read-all, PUT /settings/notifications — 상세 미확인
```

### COACHING

```ts
// POST /coaching/chat — 200 (FR-AI-04, P1). 숫자는 엔진 산출값 주입 + grounding 검사
type CoachingChatRequest = { message: string };
type CoachingChatResponse = { reply: string; coachingLogId: number };
```

## 4. 열거형과 기준 데이터 (ERD v0.1)

클라이언트 타입은 아래 값의 유니온으로 두고, 모르는 값은 `UNKNOWN` 으로 흡수해 화면이 깨지지 않게 한다(규칙 90).

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `TxType` | `CARD` `DEPOSIT` `WITHDRAW` `TRANSFER` | DEPOSIT 은 분류 대상 아님(수입) |
| `ConfirmStatus` | `AUTO` `PENDING` `CONFIRMED` | PENDING 이 질문·정리 대상, CONFIRMED 가 일 코인 조건 |
| `ExcludeTag` | `NONE` `DUTCH` `SELF_TRANSFER` `EMERGENCY` `CARRYOVER` | NONE 외에는 봉투 차감 제외. 사용자가 고를 수 있는 건 DUTCH·SELF_TRANSFER·EMERGENCY |
| `TxStatus` | `NORMAL` `CANCELED` | CANCELED 는 봉투 복원 |
| `ClassifySource` | `MERCHANT_MAP` `MODEL` `USER` | 응답에 없을 수 있음 |
| `BudgetStatus` | `PROPOSED` `CONFIRMED` | |
| `ExpenseType` | `RENT` `SUBSCRIPTION` `CARD_BILL` `LOAN` `UTILITY` | |
| `TransferStatus` | `PROPOSED` → `APPROVED` → `EXECUTED` / `FAILED` / `CANCELED` | |
| `CoinReason` | `ATTEND`(+10) `CONFIRM_ALL`(+30) `WEEKLY`(+200) `MONTHLY` `PURCHASE`(−) | |
| `SlotType`(items.item_type) | 방 `WALLPAPER` `FLOOR` `FURNITURE` · 캐릭터 `HAIR` `OUTFIT` `FACE` | 가구 배치 자리(`user_items.slot`)는 별도 문자열이며 값 목록 미확정(임시 `SOFA` `TABLE` `DECO`) |
| `NotiType` | `COACHING` `BUDGET_ALERT` `TRANSFER_REQUEST` `CLEANUP` `WARNING` | |
| `CoachPersona` | `DODO`(도도냥) `ONSOON`(온순냥, 기본) `JIBANG`(지방냥) | |
| `Season` | `AUTUMN` | MVP 1종 |
| `EmploymentStatus` | `STUDENT` `JOB_SEEKER` `EMPLOYED` `FREELANCER` | P2 프로필 |

**봉투 7종 (id 고정)**: 1 외식 · 2 교통비 · 3 의료·건강 · 4 취미·여가 · 5 쇼핑 · 6 편의점·마트·잡화 · 7 기타.

**세분류 22종**: 외식 101 음식점 · 102 카페 · 103 배달 · 104 주점 / 교통비 201 대중교통 · 202 택시 · 203 주유 / 의료·건강 301 병원·약국 · 302 운동·헬스 / 취미·여가 401 영화·공연·전시 · 402 스포츠 관람 · 403 게임·콘텐츠 · 404 여행·숙박 / 쇼핑 501 패션·잡화 · 502 뷰티 · 503 온라인 쇼핑 / 편의점·마트·잡화 601 편의점 · 602 마트 · 603 생활용품 / 기타 701 교육 · 702 해외 결제 · 703 경조사·기타.

**서버 파생값(클라이언트에서 재계산 금지)**: 봉투 잔액 = `confirmed_amount − Σ(당월·NORMAL·NONE 태그 거래)`, 코인 잔액 = `Σ(delta)`, 부족액·청구 예정액 = 06:00 배치 산출.

## 5. 규칙 90 과 다른 점 (이 계약이 우선)

| 항목 | `90-backend-contract.md` 초안 | KeyFin 계약 |
| --- | --- | --- |
| 금액 타입 | `string`(BigDecimal 직렬화) | **JSON number(원 정수)**. 화면 모델은 `lib/money.ts` 의 `KRW`(문자열) 로 변환해 쓴다 |
| 오류 봉투 | `{ code, message, traceId, details? }` | **`{ code, message }`**. `traceId` 없음. `message` 는 사용자 노출용 문구 |
| 시각 형식 | 시간대 포함 ISO-8601 | **시간대 없는 `YYYY-MM-DDTHH:mm:ss`(KST)** 와 날짜·시각 분리 필드 |
| 공통 헤더 | `Idempotency-Key`, `X-Device-Id` 등 | **`Authorization` 만**. 멱등성은 서버 기관거래고유번호로 처리 |
| 페이지네이션 | 커서 | 커서 확정(`cursor`+`size`, `nextCursor`) |
| 계약 파일 | `openapi/openapi.yaml` | OpenAPI 미제공 → **이 문서**. 제공되면 교체 |

## 6. 이 문서를 갱신하는 법

1. Notion API 명세서에서 바뀐 행 페이지를 읽는다(Claude in Chrome 으로 열어 `get_page_text`. Notion MCP 커넥터는 개인 워크스페이스만 붙어 있어 팀 페이지를 못 읽는다).
2. §2 표와 §3 타입을 고치고 머리말의 기준 일시를 갱신한다.
3. 바뀐 필드를 쓰는 `features/<domain>/model.ts` 와 `api/mocks/` 를 함께 고친다. 계약 변경 커밋은 팀 컨벤션대로 `BREAKING CHANGE` 표기 여부를 판단한다.
