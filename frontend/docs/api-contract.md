# KeyFin API 계약 사본

> **원천**: 팀 Notion [API 명세서](https://app.notion.com/p/API-036f938dd4cd82a9990b81e44d571c24)(2026-09-08 09:57 편집분) 와 [ERD v0.1](https://app.notion.com/p/ERD-033f938dd4cd820bbdd0812e6ee6f389). 백엔드가 OpenAPI(springdoc `/v3/api-docs`)를 내보내기 전까지 이 파일이 `.agents/rules/90-backend-contract.md` 가 말하는 "클라이언트 저장소의 스펙 사본"이다. OpenAPI 가 생기면 `openapi/openapi.yaml` 로 교체하고 이 파일은 삭제한다.
> 2026-09-08 기준 백엔드 55개 엔드포인트 전부 "시작 전". 아래 응답 형태는 명세이지 실제 서버 응답이 아니므로, 구현 후 다르면 클라이언트에서 우회하지 말고 불일치를 보고한다.
> **상세 미확인** 표시는 Notion 행 페이지를 아직 읽지 않은 것이고, **URL 미확인** 은 목록에 URL 이 비어 있는 것이다.
> **LINK 6개는 2026-09-11 백엔드 Swagger(Notion 공유)와 `origin/feature/finance-link`(9f2d719) 코드로 대조했다. Notion 행 페이지보다 Swagger 가 최신이다.**

## 1. 공통 규약

| 항목 | 값 | 출처 |
| --- | --- | --- |
| Base path | `/api/v1` (호스트는 `EXPO_PUBLIC_API_URL`) | API 명세서 URL 열 |
| 인증 | `Authorization: Bearer <accessToken>`. Access 30분, Refresh 14일(Redis). AUTH 3개(signup·login·refresh)를 제외한 모든 API 필수 | 기능 명세서 §0 |
| 토큰 갱신 | `POST /auth/refresh` body `{ refreshToken }` → `{ accessToken }`. 401 이면 1회 갱신 후 재시도, 갱신 실패 시 로그인 화면 | API 명세서 · 규칙 90 |
| 성공 응답 | **공통 봉투 `{ success: true, code: "SUCCESS", message, data }`. 실제 데이터는 `data` 안**. 바디 없는 성공은 `data: null`. **전 도메인 공통 포맷**(2026-09-10 백엔드 확인 — 이전 "봉투 없음" 기재는 틀렸다). 봉투는 `api/envelope.ts` 의 `unwrapEnvelope` 가 `api/client.ts` 인터셉터에서 벗기므로 도메인 함수는 `data` 만 본다. `api/mocks` 는 인터셉터를 거치지 않으므로 봉투 없이 둔다 | 백엔드 확인(2026-09-10) |
| 오류 응답 | 같은 봉투에 `{ success: false, code, message, data: null }` + HTTP 상태(전 도메인 공통). `message` 는 백엔드가 사용자 문구로 변환해 준 값. 확인된 `code` 는 §3-0 카탈로그 참고. 공통 상태: 400 입력값 · 401 인증 · 404 없음 · 405 메서드 · 409 충돌 · 415 미디어 타입 · 500 서버 · 502·503 외부 연동 | 백엔드 AUTH 마크다운(2026-09-10) |
| 명명 | camelCase. Path Variable `{id}`, 조회 조건은 Query Parameter, 변경은 JSON body | 전 행 |
| 금액 | **원 단위 정수, JSON number(Long)**. 소수·문자열 아님 | 전 행 (`balance: 1500000`) |
| 날짜·시각 | `month` `"YYYYMM"` · 날짜 `"YYYY-MM-DD"` · 시각 `"HH:mm:ss"` · 일시 `"YYYY-MM-DDTHH:mm:ss"`(**시간대 없음, KST 로컬**) | 전 행 |
| 페이지네이션 | 커서. 요청 `cursor`(마지막 조회 id, Long) + `size`(기본 20). 응답 `{ items: T[], nextCursor: number \| null }`, 마지막 페이지는 `null` | 거래·코인·알림 |
| 멱등성 | 이체 승인·재시도는 서버가 기관거래고유번호로 보장(H1007 = 이미 성공). 연결(`POST /links`)은 이미 연결된 항목 무시. 출석·코인은 `uq_coin_grant` 로 중복 차단 | 기능 명세서 |
| 시간대 | 서버는 KST. 응답의 시각 문자열에 오프셋이 없으므로 `lib/date.ts` 의 `parseISODate` 는 그대로 못 쓴다(§5 참고) | — |

## 2. 엔드포인트 목록 (55)

우선순위 P0 = MVP. 담당은 백엔드 담당자.

> 2026-09-16 저녁: 배포 서버 Swagger(`/v3/api-docs`, SSH 터널 18081)에 뜬 경로는 37개다. NOTIFICATION·COACHING·SHOP 은 아직 하나도 없고, AUTH·USER·LINK·ACCOUNT·BUDGET·TRANSACTION·PAYMENT·GAME 은 배포본이 develop 최신과 같다.
> 2026-09-17 오전: 배포 서버 = develop 9f999c4(경로 39개·동작 43개). 이 표와 경로·메서드 단위로 비교해 **새로 생긴 것은 NOTIFICATION 푸시 기기 2개**(`POST /devices` 를 대체)뿐이고, 표에 있으나 배포에 없는 것은 아래 "배포 없음" 표시 항목이다. 예산 제안 `basis` 문구에 집계 구간이 붙었다(BUDGET 절). P1 에 지금 붙일 수 있는 API: 연결 해제 2 · 코인 잔액·이력 · 아이템 조회·장착 · 카드 청구 요약·상세 · 비상금 설정 · 이체 목록·재승인 · 로그아웃 · 푸시 기기 등록·해제.
> 2026-09-22: 배포 서버 Swagger 에 **COACHING `GET·POST /coaching/chat` 이 올라왔다**(develop 9/21 코칭 대화 앱 API). 응답이 옛 기재와 달라 COACHING 절을 실제 스키마로 바꿨고 오류 `AI_001` 을 카탈로그에 더했다. 코치 말투·정책/상품 추천은 여전히 없다.
> 2026-09-18 오후: 배포 서버 Swagger = **경로 47개·동작 51개**(develop 941ccde 와 같은 범위). 2026-09-17 대비 **새로 생긴 것은 SHOP 2개**(`GET /shop` · `POST /shop/purchase`)뿐이고, 그 사이 배포된 것이 USER 프로필·탈퇴 · 알림함 조회·읽음 · 알림/코치 설정이다. 표의 51개 동작 중 배포에 있는 것은 50개이고, **배포에 있는데 이 표에 없던 것은 `PUT /settings/coach` 하나**라 아래에 추가했다. 상점 구현이 옛 기재와 여러 군데 달라 GAME 절을 고쳤다.

| 도메인 | Use Case | Method | URL | P | 담당 |
| --- | --- | --- | --- | --- | --- |
| AUTH | 회원가입 | POST | `/auth/signup` | P0 | 고예린 |
| AUTH | 로그인 | POST | `/auth/login` | P0 | 고예린 |
| AUTH | 토큰 재발급 | POST | `/auth/refresh` | P0 | 고예린 |
| AUTH | 로그아웃 | POST | `/auth/logout` | P1 | 고예린 |
| AUTH | 비밀번호 변경 | PUT | `/auth/password` — 배포 없음(2026-09-18 재확인) | P1 | 고예린 |
| USER | 이체 설정 조회 | GET | `/settings/transfer` | P0 | 고예린 |
| USER | 이체 설정 변경 | PUT | `/settings/transfer` | P0 | 고예린 |
| USER | 회원 탈퇴 | DELETE | `/users/me` — 배포됨(2026-09-18) | P1 | 고예린 |
| USER | 프로필 입력 | PUT | `/profile` — 배포됨(2026-09-18) | P2 | 고예린 |
| USER | 코치 말투 설정 | PUT | `/settings/coach` — 배포됨(2026-09-18), 이 표에 없던 행 | P1 | 고예린 |
| LINK | 금융망 연결 상태 조회 | GET | `/links/status` | P0 | 고예린 |
| LINK | 금융망 회원 연결 | POST | `/links/connect` | P0 | 고예린 |
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
| TRANSACTION | 거래 일괄 분류 확정 | PUT | `/transactions/classifications` — 배포됨(2026-09-20 확인) | P1 | 고예린 |
| TRANSACTION | 거래 메모 | PUT | `/transactions/{id}/memo` — 배포 없음(2026-09-18 재확인) | P2 | 고예린 |
| BUDGET | 예산 제안 생성 | POST | `/budgets/proposals` | P0 | 정재원 |
| BUDGET | 예산·잔액 조회 | GET | `/budgets/current` | P0 | 정재원 |
| BUDGET | 예산 승인·조정 | PUT | `/budgets/{budgetId}/confirm` | P0 | 정재원 |
| BUDGET | 월간 소비 리포트 | GET | `/reports/{month}` — 배포 없음(2026-09-18 재확인) | P1 | 정재원 |
| BUDGET | 비상금 설정 | PUT | `/budgets/{budgetId}/emergency` | P1 | 정재원 |
| BUDGET | 절감 포인트 조회 | GET | `/savings/insights` — 배포 없음(2026-09-18 재확인) | P2 | 정재원 |
| PAYMENT | 결제 통합 일정 | GET | `/payments/calendar` | P0 | 정재원 |
| PAYMENT | 고정지출 목록 | GET | `/fixed-expenses` | P0 | 정재원 |
| PAYMENT | 고정지출 등록 | POST | `/fixed-expenses` | P0 | 정재원 |
| PAYMENT | 고정지출 수정 | PUT | `/fixed-expenses/{id}` | P0 | 정재원 |
| PAYMENT | 고정지출 삭제 | DELETE | `/fixed-expenses/{id}` | P0 | 정재원 |
| PAYMENT | 이체 제안·이력 조회 | GET | `/transfers` | P0 | 정재원 |
| PAYMENT | 이체 제안 단건 조회 | GET | `/transfers/{id}` | P0 | 정재원 |
| PAYMENT | 이체 승인·실행 | POST | `/transfers/{id}/approve` | P0 | 정재원 |
| PAYMENT | 이체 나중에 하기 | POST | `/transfers/{id}/postpone` | P0 | 정재원 |
| PAYMENT | 이체 재시도 | POST | ~~`/transfers/{id}/retry`~~ 없음 — approve 재호출 | P1 | 정재원 |
| PAYMENT | 카드별 청구 요약 | GET | `/cards/billings` | P1 | 정재원 |
| PAYMENT | 카드 청구 상세 | GET | `/cards/{cardId}/billings` (`from`·`to`) | P1 | 정재원 |
| GAME | 방 홈 데이터 | GET | `/room` | P0 | 윤현준 |
| GAME | 출석 | POST | `/fin-coins/attendance` | P0 | 윤현준 |
| GAME | 보유 가구·배치 조회 | GET | `/furnitures` | P0 | 윤현준 |
| GAME | 가구 배치 변경 | PATCH | `/furnitures/{userFurnitureId}` | P0 | 윤현준 |
| GAME | 보유 아이템 조회 | GET | `/items` | P1 | 윤현준 |
| GAME | 아이템 장착·해제 | PATCH | `/items/{userItemId}` | P1 | 윤현준 |
| GAME | 코인 잔액 | GET | `/fin-coins/balance` | P1 | 윤현준 |
| GAME | 코인 이력 | GET | `/fin-coins` | P1 | 윤현준 |
| GAME | 상점 목록 | GET | `/shop` — 배포됨(2026-09-18). 응답 모양이 옛 기재와 다르다 → GAME 절 | P1 | 윤현준 |
| GAME | 상점 아이템 구매 | POST | `/shop/purchase` — 배포됨(2026-09-18). 가구를 사면 `userFurnitureId` 가 온다 → GAME 절 | P1 | 윤현준 |
| GAME | 압류 딱지 제거 | POST | `/room/stickers/remove` — develop·배포 모두 없음(2026-09-18 재확인) | P1 | 윤현준 |
| GAME | 방 테마 목록 | GET | `/themes` — develop·배포 모두 없음(2026-09-18 재확인) | P2 | 윤현준 |
| GAME | 방 테마 변경 | PUT | `/room/theme` — develop·배포 모두 없음(2026-09-18 재확인) | P2 | 윤현준 |
| NOTIFICATION | 푸시 기기 등록·갱신 | PUT | `/me/push-devices/{installationId}` (옛 `POST /devices`) | P0 | 윤현준 |
| NOTIFICATION | 푸시 기기 연결 해제 | DELETE | `/me/push-devices/{installationId}` | P0 | 윤현준 |
| NOTIFICATION | 알림함 조회 | GET | `/notifications` — 배포됨(2026-09-18) | P1 | 윤현준 |
| NOTIFICATION | 알림 읽음 처리 | **PATCH** | `/notifications/{id}/read` — 배포됨(2026-09-18) | P1 | 윤현준 |
| NOTIFICATION | 알림 전체 읽음 처리 | PUT | `/notifications/read-all` — develop 에도 없음(2026-09-18 재확인) | P1 | 윤현준 |
| NOTIFICATION | 알림 설정 변경 | PUT | `/settings/notifications` — 배포됨(2026-09-18) | P1 | 윤현준 |
| COACHING | 코칭 대화(질문 한 턴) | POST | `/coaching/chat` — **배포됨(2026-09-22 Swagger)**. 응답 형태가 옛 기재와 다르다 → COACHING 절 | P1 | 윤현준 |
| COACHING | 코칭 대화 이력 | GET | `/coaching/chat` — 배포됨(2026-09-22 Swagger). 표에 없던 것을 추가 | P1 | 윤현준 |
| COACHING | 코치 말투 선택 | PUT | URL 미확인 | P1 | 윤현준 |
| COACHING | 지원 정책 추천 | GET | URL 미확인 | P2 | 윤현준 |
| COACHING | 금융 상품 추천 | GET | URL 미확인 | P2 | 윤현준 |

## 3-0. 오류 코드 카탈로그

2026-09-10 백엔드 확인분. 여기 없는 `code` 는 서버 `message` 를 그대로 보여준다(규칙 90).

| code | HTTP | 뜻 |
| --- | --- | --- |
| `COMMON_001` | 400 | 입력값이 올바르지 않습니다 |
| `COMMON_002` | 400 | 요청 본문을 읽을 수 없습니다 |
| `COMMON_006` | 500 | 서버 내부 오류 |
| `AUTH_001` | 401 | 로그인 실패(없는 계정·비밀번호 불일치·탈퇴 계정 공통) |
| `AUTH_002` | 401 | 유효하지 않은 토큰(위조·형식 오류) |
| `AUTH_003` | 401 | 만료된 토큰 |
| `AUTH_004` | 401 | 유효하지 않은 리프레시 토큰 |
| `AUTH_005` | 401 | 인증이 필요합니다(Access Token 누락) |
| `USER_001` | 404 | 사용자를 찾을 수 없습니다(없거나 탈퇴) |
| `USER_002` | 409 | 이미 사용 중이거나 탈퇴 이력이 있는 이메일 |
| `USER_004` | 409 | 이미 다른 금융망 사용자와 연결돼 있습니다 |
| `LINK_001` | 409 | 그 금융망 사용자는 다른 KeyFin 계정이 쓰고 있습니다 |
| `LINK_002` | 409 | 금융망 회원 미연결(`POST /links/connect` 먼저) |
| `LINK_003` | 400 | 연결할 계좌 또는 카드를 하나 이상 선택해야 함(accountIds·cardIds 모두 비어 있음) |
| `LINK_004` | 404 | 계좌를 찾을 수 없음(없거나 본인 소유 아님) — 후보 목록 재조회 안내 |
| `LINK_005` | 404 | 카드를 찾을 수 없음(없거나 본인 소유 아님) — 후보 목록 재조회 안내 |
| `FINANCE_001` | 404 | 금융망에서 일치하는 사용자를 찾을 수 없습니다 |
| `FINANCE_002` | 502 | 금융망 응답을 처리할 수 없습니다 |
| `FINANCE_003` | 502 | 금융망 연동 설정 오류(API Key 무효 H1008) |
| `FINANCE_004` | 503 | 금융망 일시 장애·타임아웃 |
| `AI_001` | 503 | 코칭 서버 응답 없음 — "코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요."(2026-09-22 develop CoachingErrorCode) |
| `AI_002` | 404 | 차트 없음(다른 계정의 차트 포함) — "차트를 찾을 수 없어요."(2026-09-23 develop) |
| `AI_003` | 422 | 코칭 서버가 질문을 거절(되묻기 대상이 아닌 4xx) — "질문을 이해하지 못했어요. 조금 다르게 물어봐 주세요."(2026-09-23 develop) |
| `FINANCE_005` | 409 | 금융망 연결이 유효하지 않음(userKey 무효 H1009) — 금융망 재연결 필요 |

401 중 `AUTH_003`·`AUTH_005` 는 갱신으로 풀릴 수 있으므로 인터셉터의 refresh 재시도 대상이다. `AUTH_002` 는 위조라 갱신해도 실패하지만 같은 경로로 흘려보내고 실패하면 로그인으로 보낸다.

## 3. 엔드포인트 상세

타입은 TypeScript 표기. `?` 는 선택(응답에서는 조건부로 오거나 `null`). 열거형 값은 §4.

### AUTH

```ts
// 2026-09-10 구현본 확인. 아래 타입은 모두 공통 봉투의 data 안에 온다: { success, code, message, data }
// signup·login·refresh 는 Bearer 불필요, logout 은 Access Token 필요

// POST /auth/signup — 201. 사용자 + 프로필·설정 기본행 생성.
// 금융망 연결과 기본 아이템 지급은 별도 과정(구현본 설명). 이전 "한 트랜잭션에 아이템 지급" 기재는 틀렸다 — 홈 기본 착장 전제 재확인 필요 (TBD)
type SignupRequest = { email: string; password: string; name: string };
type SignupResponse = { userId: number };
// 400 COMMON_001 입력값 · 409 USER_002 이미 사용 중이거나 탈퇴 이력이 있는 이메일

// POST /auth/login — 200. Access 30분 · Refresh 14일
type LoginRequest = { email: string; password: string };
type LoginResponse = { accessToken: string; refreshToken: string; user: { id: number; name: string } };
// 401 AUTH_001 — 탈퇴 계정·없는 계정·비밀번호 불일치가 모두 같은 응답(사유 비노출)

// POST /auth/refresh — 200. Redis 저장값과 대조해 새 Access Token 만 발급, 기존 Refresh Token 은 만료까지 유지
type RefreshRequest = { refreshToken: string };
type RefreshResponse = { accessToken: string };
// 401 AUTH_004 유효하지 않거나 만료됐거나 Redis 값과 다른 Refresh Token

// POST /auth/logout — 200, data: null. Redis 의 Refresh Token 삭제로 이후 재발급 차단.
// 이미 발급된 Access Token 은 남은 30분 동안 유효하므로 클라이언트도 저장분을 지운다
// 401 AUTH_002 토큰 없음·유효하지 않음

// PUT /auth/password — 미구현(AUTH 5개 중 유일). 상세 미확인
```

### USER

```ts
// GET /settings/transfer — 200 (FR-PAY-04 입력값). 요청 바디·파라미터 없음. URL 은 2026-09-13 `/settings` 에서 변경
// 2026-09-14 develop TransferSettingsController 로 대조: 한도는 null 이면 미설정(가입 직후 기본값)
// 2026-09-16 Notion 행 2개(이체 설정 조회/변경) ↔ develop f67baf4 재대조. 코드·앱·이 사본은 일치. **Notion 이 옛 버전** —
//   한도를 필수 Long 으로 적었지만 코드는 nullable(@Positive, null 이면 미설정), "개별 에러 없음" 이지만 USER_005·USER_006 이 있다. 팀에 정정 요청.
// 가입 직후 기본값: transferConsent=false, 한도 둘 다 null (UserSettings 엔티티). user_settings 행은 가입 시 만들어져 USER_006 은 정상 흐름에서 안 난다.
type TransferSettings = { transferConsent: boolean; transferLimitOnce: number | null; transferLimitDaily: number | null };

// PUT /settings/transfer — 200. 요청·응답 모두 TransferSettings. 한도는 각각 양수 또는 null(미설정 = 이체 승인 시 그 검사를 건너뜀).
// 관계 검사(1일 < 1회 → USER_005)는 둘 다 값이 있을 때만 한다. 앱은 동의가 켜져 있으면 둘 다 입력하게 해 계약보다 엄격하다(FE 결정).
// 오류: 400 COMMON_001(동의 null) · 400 USER_005 한도 0 이하 또는 1일 < 1회 · 404 USER_001 탈퇴 사용자 · 404 USER_006 사용자 설정 없음

// DELETE /users/me — **204(본문 없음)** (P1). 2026-09-20 배포 서버 Swagger 대조.
//   ★ 현재 비밀번호를 본문으로 확인한다: { password: string }(1자 이상). 계정을 소프트 삭제하고 서버의 Refresh Token 을 지우며,
//   탈퇴한 이메일로는 다시 가입할 수 없다(가입 시 409 USER_002).
//   오류: 400 COMMON_001(비밀번호 누락) · **401 USER_007(현재 비밀번호 불일치)** · 404 USER_001
//   ⚠️ 401 은 api/client.ts 의 토큰 갱신 인터셉터가 한 번 재시도한다 — 비밀번호가 틀린 경우 갱신 후 같은 401 이 다시 와서
//      USER_007 로 화면에 전달된다(계정은 그대로). 갱신 자체가 실패하면 세션 만료로 보고 로그인으로 보낸다.
//   앱 구현(2026-09-20): features/auth 의 model(canSubmitAccountDeletion) · auth.api(deleteAccount) · queries(useDeleteAccount —
//      성공했을 때만 푸시 해제·토큰 삭제·캐시 비우기) · WithdrawAccountButton(마이 탭). 문구는 features/auth/errors.ts.

// PUT /profile — 상세 미확인

// 온보딩 완료 표시 — 없음. 백엔드에 요청(2026-09-11, 사용자 결정: 서버 값으로 판정).
// 제안: 첫 PUT /budgets/{month}/confirm 성공 시 서버가 완료를 기록하고, 앱 시작 시 GET 으로 조회.
// 받기 전까지 온보딩 게이트(app/(tabs)/_layout.tsx)는 GET /links/status 의 connected 만 본다. (TBD)
```

### LINK

```ts
// GET /links/status — 200. 현재 사용자의 금융망 연결 여부.
// users.fin_user_key 존재 여부로 판정한다. **미연결도 정상 상태라 404 가 아니라 200 + false 로 온다.**
// 온보딩에서 PAGE-03B 를 보여줄지 정하는 근거이며, 클라이언트가 따로 기록하지 않는다.
type FinanceStatusResponse = { connected: boolean }; // 연결 API 와 같은 DTO(FinanceLinkResponse)
// 401 AUTH_002·AUTH_003·AUTH_005 · 404 USER_001 · 500 COMMON_006
// Notion 의 financeConnected 는 고치지 않은 오기다. 2026-09-11 백엔드 확인·Swagger 실응답 모두 connected.

// POST /links/connect — 200. 금융망 회원 연결. Bearer 필요
// KeyFin 사용자의 토큰으로 인증하고, 입력한 금융망 이메일로 SSAFY 금융망 회원을 **조회**해 userKey 를 서버가 보관한다.
// 금융망 회원을 새로 만들지는 않는다. userKey 는 응답에 노출하지 않고 클라이언트가 보내지도 않는다.
// 이미 같은 금융망 회원과 연결돼 있으면 성공으로 처리한다(멱등).
// 이 연결이 끝나야 GET /links/candidates 가 후보를 돌려준다 → 온보딩에서 약관(PAGE-03) 다음, 자산 선택(PAGE-04) 앞에 온다.
type FinanceLinkRequest = { financeEmail: string }; // 필수, 이메일 형식, 최대 100자. KeyFin 가입 이메일과 달라도 된다
type FinanceLinkResponse = { connected: boolean };
// 400 COMMON_001·COMMON_002 · 401 AUTH_002·AUTH_003·AUTH_005 · 404 USER_001·FINANCE_001
// 409 LINK_001·USER_004 · 502 FINANCE_002·FINANCE_003 · 503 FINANCE_004 · 500 COMMON_006
// Notion 행 본문에는 URL 이 없고, 다른 LINK 행의 오류 설명과 백엔드 @PostMapping("/connect") 로 확인했다.

// GET /links/candidates — 200 (FR-USR-02). 금융망 수시입출금 계좌·카드를 조회해 KeyFin 에 동기화하고(신규는 미선택)
// 모든 항목에 KeyFin id 를 붙여 돌려준다. 잔액은 금융망 실시간 값. 계좌·카드는 id 공간이 따로라 서로 겹칠 수 있다.
// managed 는 관리 대상(is_managed=true) 여부 — 연결 해제한 자산은 managed=false 로 다시 나타나고 POST /links 로 재연결한다.
// id 는 POST /links·연결 해제·수입 계좌 지정(PUT /accounts/{id}/income)에 그대로 쓴다.
type LinkCandidates = {
  accounts: { id: number; finAccountNo: string; bankCode: string; bankName: string; balance: number; managed: boolean }[];
  cards: { id: number; cardNo: string; issuerName: string; cardName: string; withdrawalAccountNo: string; managed: boolean }[];
};
// 카드에는 카드사 코드가 없다 → 로고는 issuerName 매칭(bankLogoByName)
// 404 USER_001 · 409 LINK_002 미연결·FINANCE_005 userKey 무효(둘 다 금융망 재연결) · 502 FINANCE_002·FINANCE_003 · 503 FINANCE_004

// POST /links — 201. 후보의 KeyFin id 를 관리 대상으로 전환한다. **금융망을 부르지 않는다.**
// 이미 관리 중인 항목은 건너뛰어 응답 수에 넣지 않고(멱등), 해제했던 항목은 다시 관리 대상이 된다. 본인 소유가 아닌 id 는 404.
type LinkRequest = { accountIds: number[]; cardIds: number[] }; // 둘 중 하나 이상, 각 최대 50개, 원소는 양의 정수(null 불가)
type LinkResponse = { accounts: number; cards: number };        // 이번 요청으로 새로 연결·복구된 수
// 400 COMMON_001(50개 초과·null·음수)·LINK_003(둘 다 비어 있음) · 404 USER_001·LINK_004(계좌)·LINK_005(카드)
// Swagger 예시 요청의 "empty": true 는 백엔드 record 의 isEmpty() 가 스키마에 새어 나온 것이다. 클라이언트는 보내지 않는다.

// DELETE /links/accounts/{accountId} — 200, data: null (P1, FR-USR-05). accountId 는 candidates 의 accounts[].id
// 행을 지우지 않고 is_managed=false 로 바꿔 거래 이력을 보존한다. 수입 계좌 지정(is_income)도 함께 풀린다(Notion 행 기준).
// 이미 해제된 계좌를 다시 해제해도 성공(멱등). 다시 관리하려면 POST /links. 404 USER_001·LINK_004
// DELETE /links/cards/{cardId} — 200, data: null (P1). cardId 는 candidates 의 cards[].id. 404 USER_001·LINK_005
// ★ 2026-09-17 Notion 행 2개(계좌·카드 연결 해제, 비고 "id 추가(9/10)") ↔ develop 1a30b03 코드·배포 Swagger 재대조. **코드가 맞고 Notion 이 9/10 옛 버전**:
//   - Notion 은 경로 id 출처를 candidates 의 `linkedId` 라 적었지만 9/11(24a5036) 동기화 구조 전환으로 필드는 `id` 다(LinkCandidatesResponse). 계좌는 GET /accounts 의 id 와 같은 값.
//   - Notion 오류 코드 계좌 LINK_005 · 카드 LINK_006 → 코드는 계좌 **LINK_004** · 카드 **LINK_005**(LinkErrorCode 에 006 없음). Swagger 도 004/005.
//   - 일치: 행 삭제 없이 managed=false, 계좌만 is_income 도 false(Account.unlink), 이미 해제돼도 200(소유만 확인), data null.
// 해제가 다른 기능에 주는 영향(코드 확인, Notion 에 없음):
//   - 계좌·카드 모두 거래 수집 대상에서 빠진다(TransactionSyncService 가 managed 아니면 LINK_004/005).
//   - 수입 계좌를 해제하면 관리 중인 수입 계좌가 없어 이체 제안이 만들어지지 않고(TransferProposalService),
//     이미 제안된 이체를 승인하면 출금 계좌 부적격으로 보류된다(TransferService → TRANSFER_ACCOUNT_INELIGIBLE).
//   - 해제한 계좌는 고정지출 출금 계좌로 등록·수정할 수 없다(FixedExpenseService → ACCOUNT_NOT_MANAGED).
//   - 카드를 해제하면 카드 청구 요약(GET /cards/billings)과 결제 캘린더 CARD_BILL 에서 빠진다(managed 카드만 조회).
```

### ACCOUNT

```ts
// 2026-09-11 백엔드 develop(751a781) AccountController·DTO 로 대조. Swagger 는 아직 못 받음.
// 앱 사용처: 수입 계좌 지정(PAGE-05), 자산 탭 계좌·총 자산(PAGE-11), 거래 내역 계좌 필터.

// GET /accounts — 200. 관리 중(isManaged=true)인 계좌만 id 오름차순. 금융망을 부르지 않는다
type AccountList = {
  items: {
    id: number;                 // KeyFin 계좌 id — PUT income·거래 필터 accountId·/links/candidates 의 accounts[].id 와 같다
    finAccountNo: string;
    bankName: string;           // 은행 코드는 없다 → 로고는 은행명 매칭(bankLogoByName)
    alias: string | null;
    isIncome: boolean;          // 사용자당 1개
    isManaged: boolean;
    balance: number;            // 원. 금융망 실시간이 아니라 마지막으로 갱신된 스냅샷
    balanceUpdatedAt: string;   // 시간대 없는 KST "YYYY-MM-DDTHH:mm:ss"
  }[];
};
// 401 AUTH_002 무효 · AUTH_003 만료 · AUTH_005 토큰 없음(코드와 무관하게 401 이면 api/client.ts 가 1회 갱신) · 403 AUTH_006 · 404 USER_001 · 500 COMMON_006

// PUT /accounts/{id}/income — 200, data: null. 수입 계좌 지정·변경. 기존 수입 계좌는 자동 해제, 이미 수입 계좌면 그대로 성공
// 404 ACCOUNT_001 계좌를 찾을 수 없음(없거나 남의 계좌) · 409 ACCOUNT_002 관리 중인 계좌만 지정 가능
// Notion 행 페이지는 "404 ERR_ACCOUNT_NOT_FOUND" 만 적힌 옛 형식이다(409 누락). 코드 기준으로 둔다
// 2026-09-15 develop(c700162) 재대조: 계좌 코드는 751a781 이후 변경 없음. balance_updated_at 은 DATETIME(소수점 초 없음)
// 2026-09-16 Notion 행 2개(수입 계좌 지정·연결 계좌 목록) ↔ develop f67baf4 재대조: 코드·앱·이 사본 일치. Notion 은 여전히 옛 코드명(ERR_ACCOUNT_NOT_FOUND)이고
//   409 ACCOUNT_002·404 USER_001 이 빠져 있다 — 팀에 정정 요청. 지정은 멱등(이미 수입 계좌면 그대로 200), 지정 전에 isManaged 를 검사한다(AccountService).
//   앱 쪽 미결: 수입 계좌 변경 진입점이 온보딩(PAGE-05)뿐이라 온보딩 뒤에는 바꿀 수 없다. 이체 안전장치 PAY_010·연결 해제 후 재지정에 필요 (TBD)
// 계좌 연결 해제(DELETE /links/accounts/{id})하면 수입 지정도 풀린다(LINK 절)
```

### TRANSACTION

```ts
// 2026-09-15 저녁 백엔드 develop 1ec4835(feature/transaction-collection·history) 코드 기준으로 다시 씀. 노션 9/8 초안과 다른 곳은 ★.
type Transaction = {
  id: number;
  txType: TxType;                 // CARD | DEPOSIT | WITHDRAW | TRANSFER | CARD_BILL
  merchantName: string | null;    // ★ 가맹점명 또는 계좌 거래 원문(요약·메모), 없으면 null
  amount: number;                 // 원
  txDate: string;                 // "2026-09-08"
  txTime: string;                 // "14:21:00"
  envelopeId: number | null;      // ★ 세분류가 없으면 null(PENDING·제외 태그·입금)
  subcategoryId: number | null;   // ★
  subcategoryName: string | null; // ★
  confirmStatus: ConfirmStatus;   // AUTO(가맹점 자동 분류) | PENDING(모르는 가맹점·계좌 출금) | CONFIRMED
  excludeTag: ExcludeTag;         // NONE | DUTCH | SELF_TRANSFER | EMERGENCY | CARRYOVER | RESTORE ★(환급 입금)
  status: TxStatus;               // NORMAL | CANCELED
  memo: string | null;
  accountId: number | null;       // ★ 계좌 거래만
  cardId: number | null;          // ★ 카드 거래만
  adjustedAmount: number | null;  // ★ DUTCH 실제 부담액
};
// ★ 서버는 PENDING 거래에 "제안 세분류"를 주지 않는다(subcategory null). 코치 말풍선의 "X 맞나냥? [확정]" 은 AUTO 분류된 거래에만 가능 → 미결.

// GET /transactions — 200 (FR-TXN-09). 커서 페이지, 거래일자·시각 최신순. CANCELED·제외 태그 거래도 반환(뱃지 표시는 FE)
type TransactionListQuery = {
  month?: string;           // "YYYYMM", 생략 시 현재 월 ★(선택). 형식 오류 400 TRANSACTION_001
  envelopeId?: number; subcategoryId?: number; accountId?: number; cardId?: number; // 0 이하 400 TRANSACTION_003
  cursor?: number;          // 이전 응답의 nextCursor
  size?: number;            // 1~100, 기본 20. 밖이면 400 TRANSACTION_002
};
type TransactionListResponse = { items: Transaction[]; nextCursor: number | null };

// GET /transactions/pending?cursor=&size= — 200. ★ 커서·size 있음(같은 규칙). 전체 기간의 PENDING 정상 출금 거래 최신순
type PendingTransactionsResponse = TransactionListResponse;

// PUT /transactions/{id}/classification — 200 (FR-TXN-03). subcategoryId 와 excludeTag 중 하나만. 이미 확정된 거래도 수정 가능
type ClassifyRequest =
  | { subcategoryId: number }
  | { excludeTag: "DUTCH"; adjustedAmount: number }   // ★ 더치페이는 실제 부담액 필수(1 이상·거래 금액 이하, 아니면 400 TRANSACTION_008)
  | { excludeTag: "SELF_TRANSFER" }
  | { subcategoryId: number; excludeTag: "RESTORE" }; // ★ 환급 입금(DEPOSIT)만
// ★ EMERGENCY 는 "비상금 기능 연동 전까지 사용할 수 없다"(노션 거래 분류 행, 2026-09-15 확인) → 서버 400 TRANSACTION_006. FE 는 비상금 칩을 뺐다. 입금(RESTORE 제외)·취소 거래는 409 TRANSACTION_007
// 노션 거래 분류·거래 내역 행(2026-09-15 사용자 전달)은 이 코드와 일치. 노션 "미확정 거래 목록" 행은 본문이 거래 내역 조회를 그대로 복사한 것이라(경로·설명이 /transactions) 백엔드 확인 필요
type ClassifyResponse = { transactionId: number; subcategoryId: number | null; excludeTag: ExcludeTag; adjustedAmount: number | null; confirmStatus: ConfirmStatus };
// ★ 봉투 잔액(envelopeBalance)은 없다 → FE 는 예산 조회를 다시 받는다
// 오류: 404 TRANSACTION_004(거래) · 404 TRANSACTION_005(세분류) · 400 TRANSACTION_006(조합) · 409 TRANSACTION_007 · 400 TRANSACTION_008 · 404 USER_001

// GET /subcategories — 200 (노션 "세분류 목록" = develop SubcategoryController). 파라미터 없음, 정적 22종.
// ★ 2026-09-16 저녁 재대조 정정: 응답은 평탄한 목록이 아니라 **봉투별 묶음**이다(SubcategoryService 가 envelope_id 로 그룹핑).
//   앞선 9/16 대조에서 평탄한 모양으로 잘못 적었고 FE DTO 도 그랬다 → 같은 날 DTO·변환·목을 묶음 모양으로 고쳤다(화면 모델은 평탄한 Subcategory[] 그대로).
type SubcategoryListResponse = {
  items: { envelopeId: number; envelopeName: string; subcategories: { id: number; name: string }[] }[];
};
// (2026-09-15 까지 "백엔드에 없음" 이었으나 develop 591f0b6 에 들어왔다)
// 2026-09-16 Notion 행 4개 재대조: 세분류·거래 분류·거래 내역은 코드와 일치. "미확정 거래 목록" 행은 **여전히 거래 내역 본문 복사본** — 실제는
//   GET /transactions/pending?cursor=&size= (PENDING·NORMAL·DEPOSIT 제외, 최신순, 오류 TRANSACTION_002·003·USER_001) → 팀에 정정 요청.
//   앱: getPendingTransactions 가 cursor·size 를 보내는 커서 페이지(useInfiniteQuery)로 바뀜(2026-09-16). 정리 화면은 끝에서 다음 쪽을 받고, 홈 코치 건수는 첫 쪽 기준이라 더 남으면 "n건+" 로 적는다
// PUT /transactions/classifications — 200 (FR-TXN-03, P1). 2026-09-20 배포 서버 Swagger 대조.
//   정리 세션에서 여러 PENDING 거래를 한 번에 확정한다. 최대 100건이고 **한 건이라도 실패하면 전체 롤백**이라 부분 성공이 없다.
//   항목 조합은 단건 확정과 같다: 일반 소비 subcategoryId · DUTCH 는 adjustedAmount · SELF_TRANSFER·BUDGET_EXCLUDED·EMERGENCY 는 excludeTag · 환급은 subcategoryId + RESTORE.
type BulkClassifyRequest = { items: { transactionId: number; subcategoryId?: number | null; excludeTag?: string | null; adjustedAmount?: number | null }[] };
type BulkClassifyResponse = { confirmed: number; pendingRemain: number };  // pendingRemain 은 처리 뒤 남은 전체 미확정 수
// 오류: 400 COMMON_001(건수·중복 id)·TRANSACTION_006·008 · 404 TRANSACTION_004~005·USER_001 · 409 TRANSACTION_007(PENDING 아님·취소·입금)
// 앱 구현(2026-09-20): features/transaction 의 model(suggestedForBulk·toSuggestedBulkRequest) · transaction.api · queries(useBulkClassifyTransactions) · PendingCleanupScreen 하단 버튼.
//   제안 세분류가 있는 건만 보내므로 지금 보내는 항목은 { transactionId, subcategoryId } 뿐이다.

// PUT /transactions/{id}/memo(P2) — 상세 미확인
```

### BUDGET

```ts
// POST /budgets/proposals — 200 (FR-USR-04, FR-BGT-01). 2026-09-11 백엔드 develop(a30c392) 코드 확인.
// **요청 본문 없음** — 대상 월은 서버가 요청 시점과 사용자 예산 기준일로 정하고 응답 month 로 알려준다.
// basis 는 표시 문자열: "최근 N개월 평균 (YYYY-MM-DD~YYYY-MM-DD)" | "기본 템플릿"(이력 없음). adjustment 필드 없음.
// ★ 2026-09-17 develop 9f999c4(배포됨): 집계 구간이 "마지막 거래일 기준 3개월"로 바뀌고 basis 뒤에 실제 구간이 붙는다.
//   앱은 basis 를 파싱하지 않고(이력 판단은 monthlyAvg 값) 그대로 표시하므로 깨지지 않지만, PAGE-06 A·PAGE-07 문구가 길어진다.
// ⚠️ 같은 달에 예산이 이미 있으면 409 BUDGET_001(멱등 아님) → 앱 재시작 후 다시 부르면 제안을 되찾을 수 없다. 백엔드 요청 중 (TBD)
// 노션 "예산 제안 생성"(2026-09-12 대조): HTTP 201·오류 코드 ERR_BUDGET_EXISTS 로 적혀 있지만 코드는 200·BUDGET_001 — 코드가 맞다.
// 노션도 "동일한 월 재생성 = 409" 라 멱등 아님은 의도된 동작이다. P1 월초 조정 제안은 basis="전월 실적 조정" + envelopes[].adjustment.
type ProposalResponse = {
  budgetId: number; month: string; status: BudgetStatus; basis: string;
  envelopes: { envelopeId: number; name: string; proposedAmount: number; monthlyAvg: number }[];
};

// GET /budgets/current — 200 (노션 "예산·잔액 조회" = 백엔드 코드, 2026-09-12 대조·앱 반영). 파라미터 없음, 주기는 서버가 정한다.
// 이번 주기 예산이 없으면 서버가 제안을 만들어 PROPOSED 로 준다(예산 없음 상태 없음). PROPOSED → 앱은 예산 확정 화면으로 강제 이동.
// month = 주기 시작일이 속한 달 라벨(기준일 사용자는 달력 월과 다름) → 화면엔 periodFrom~periodTo 를 쓴다.
// PROPOSED: total=null, 봉투 proposedAmount 만 · CONFIRMED: 봉투 proposedAmount=null, 확정액 0 봉투는 remainingRate=null(빈 트랙, 지출 시 초과색)
type CurrentBudget = {
  budgetId: number; month: string; periodFrom: string; periodTo: string; status: BudgetStatus;
  total: { confirmed: number; spent: number; remaining: number; remainingRate: number | null } | null;
  envelopes: { envelopeId: number; name: string; proposedAmount: number | null; confirmedAmount: number | null;
    spent: number | null; remaining: number | null; remainingRate: number | null }[]; // envelopeId 오름차순 7개
  emergency: { amount: number; spent: number; remaining: number }; // ★ 2026-09-16 신설 — 항상 온다(PROPOSED 포함)
};
// ★ 비상금(가상 풀, 백엔드 a95d9e1 `feature/59-emergency-fund`, 2026-09-16 대조):
//   amount 0 = 미설정 · spent = 주기 안 EMERGENCY 태그 거래 합 · remaining = amount − spent(음수 가능).
//   ⚠️ 거래를 EMERGENCY 로 분류하는 경로가 아직 막혀 있다(Transaction.confirmExclusion 은 DUTCH·SELF_TRANSFER 만 허용,
//      그 밖은 400 TRANSACTION_006) → **지금은 spent 가 항상 0 이다.** 백엔드 확인 필요.
//   FE: BudgetDto·Budget 에 반영 완료(2026-09-16). 설정 화면은 P1 이라 화면에서 쓰는 곳은 아직 없다.
// 아래 옛 GET /budgets/{month} 타입은 참고로만 남긴다.
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

// PUT /budgets/{budgetId}/confirm — 200 (FR-BGT-02). **경로는 month 가 아니라 제안의 budgetId** (develop a30c392 확인)
type ConfirmBudgetRequest = { envelopes: { envelopeId: number; amount: number }[] }; // 봉투 7개 전부, 금액 0 이상·1,000원 단위
type ConfirmBudgetResponse = { budgetId: number; month: string; status: "CONFIRMED" };
// 404 BUDGET_002 없음 · 409 BUDGET_003 이미 확정 · 400 BUDGET_004 봉투 구성 불일치 · 400 BUDGET_005 1,000원 단위 아님
// 노션 "예산 승인·조정"(2026-09-12 대조, 코드와 일치): budgetId 는 제안 응답 값이고 요청 시점으로 주기를 다시 계산하지 않는다.
// **확정은 주기당 1회**(주기 중 변경 불가, 초과는 비상금 FR-BGT-09). FE 권고: 확정 전 확인 다이얼로그("시작 후에는 변경할 수 없어요"), 슬라이더 step 1,000원.

// GET /reports/{month} — 200 (FR-BGT-07). 예산 확정 전 월은 404. 시딩된 과거 3개월도 조회 가능
type ReportResponse = {
  month: string;
  total: { confirmed: number; spent: number; overAmount: number };
  envelopes: { envelopeId: number; name: string; proposedAmount: number; confirmedAmount: number; spent: number; overAmount: number; prevMonthSpent: number }[];
  topSubcategories: { subcategoryId: number; name: string; spent: number; count: number }[];
};

// ★ PUT /budgets/{budgetId}/emergency — 200 (P1, 2026-09-16 신설). 경로가 month 가 아니라 **budgetId** 다(confirm 과 같은 형태).
//   요청 { amount: number }  — 0 이상, **1,000원 단위**, 0 이면 해제. 응답 { budgetId, emergency: { amount, spent, remaining } }
//   오류: 404 BUDGET_002(예산 없음·남의 예산) · 400 BUDGET_005(1,000원 단위 아님). 확정 여부와 무관하게 바꿀 수 있다.
//   앱 구현(2026-09-20): features/budget 의 model(입력 검사·요청 변환) · budget.api · queries(useUpdateEmergencyFund — 응답을 현재 주기 예산 캐시에 바로 넣는다) · BudgetScreen 의 '비상금' 구역. 문구는 features/budget/errors.ts.
// GET /savings/insights(P2) — 상세 미확인
```

### PAYMENT

```ts
// 2026-09-15 Notion 행 5개(결제 통합 일정·고정지출 등록/수정/삭제/목록) ↔ 백엔드 develop(2e7d09e·ffd607d·64224fa) 대조, 둘이 일치.

// GET /payments/calendar?month=YYYYMM — 200 (FR-PAY-01·02). month 는 달력 월(예산 주기와 무관), 생략 시 이번 달, 형식 오류 400 COMMON_001.
// ★ GET /cards/billings — 200 (P1, develop 17e91c7 `feature/56-card-billing-summary`, 2026-09-16 배포 서버 Swagger 대조).
// 관리 대상 카드마다 이번 주기(cycleFrom = 이번 주 월요일 ~ asOf) LIVE 승인 합계·건수와 발행된 최근 청구서 1건.
// 카드 이름·카드번호·발급사는 이 응답에 **없다** → 앱은 GET /links/candidates 의 연결 카드와 cardId 로 잇는다.
type CardBillingSummary = {
  asOf: string; cycleFrom: string; nextBillingDate: string;   // "2026-09-16"
  cards: {
    cardId: number; cardName: string;
    withdrawalWeekday: number | null;   // 1(월)~7(일). null = 출금 요일 미저장(재연결 필요) → 출금일이 전부 null 이고 캘린더에도 안 나온다
    withdrawalAccountId: number | null;
    estimated: { amount: number; approvalCount: number; withdrawalDate: string | null }; // 승인 없으면 0·0
    latestStatement: { billingId: number; billingDate: string; amount: number;
      status: "UNPAID" | "PAID"; withdrawalDate: string | null; paidAt: string | null } | null; // 청구서 없으면 null
  }[];
};
// estimated 는 예상값, latestStatement 는 발행된 확정값이다. 앱(자산 탭 카드)은 estimated 와 출금 예정일만 쓴다.
// ★ GET /cards/{cardId}/billings?from=&to= — 200 (P1). 예정액 + 근거 승인 목록(최신순, 취소 제외) + 발행 청구서 목록.
//   from·to 는 청구서 발행 월(yyyyMM), 생략 시 전월~이번 달, 최대 12개월. 카드 연결 달의 전월 이전은 동기화 대상이 아니라 안 나온다.
//   2026-09-17 백엔드 develop CardBillingController·CardBillingDetailResponse 코드 대조 → PAGE-33 구현(from·to 생략).
type CardBillingDetail = {
  asOf: string; cycleFrom: string; nextBillingDate: string;  // 요약과 같은 주기
  cardId: number; cardName: string; withdrawalWeekday: number | null; withdrawalAccountId: number | null;
  estimated: { amount: number; withdrawalDate: string | null;       // 출금 요일 모르면 null
    approvals: { transactionId: number; date: string; merchantName: string; amount: number }[] }; // 이번 주기 LIVE 승인, 최신순, merchantName 원문
  from: string; to: string;                                          // 적용된 발행 월 범위 "yyyyMM"
  statements: { billingId: number; billingDate: string; amount: number;
    status: "UNPAID" | "PAID"; withdrawalDate: string | null; paidAt: string | null }[]; // 발행일 최신순. paidAt 은 시간대 없는 KST
};
//   오류: 400 COMMON_001(from·to 형식·역순·12개월 초과) · 404 PAY_013(본인 카드 아님·없음 — 관리 해제된 카드는 본인 것이면 조회된다).

// 2026-09-15 저녁 develop 69fdacb(feature/40-required-amount) 대조: 동기화는 호출 시가 아니라 PaymentSyncScheduler(08:00·17:00 KST)가 정기결제·카드 청구를 받아 둔다
// (Swagger 설명의 "호출 시 동기화"는 옛 문장). CARD_BILL = 주 단위 카드 청구(발행분은 정확 금액, 이번 주 승인 합계는 estimated=true 로 다음 출금일에).
type CalendarResponse = {
  month: string; // "YYYYMM"
  days: {        // 날짜 오름차순, 항목 없는 달은 []
    date: string; // "2026-09-15", 출금일이 없는 달(29~31)은 말일 보정. 결제 완료 청구는 결제일
    items: {      // 같은 날: FIXED → CARD_SUBSCRIPTION → CARD_BILL, 금액 내림차순
      type: "FIXED" | "CARD_SUBSCRIPTION" | "CARD_BILL";
      fixedExpenseId: number | null;      // FIXED·CARD_SUBSCRIPTION
      cardId: number | null;              // CARD_BILL 만
      name: string;                       // CARD_BILL 은 카드명
      expenseType: ExpenseType | null;    // CARD_BILL 은 "CARD_BILL"
      amount: number;
      estimated: boolean;                 // 변동형 예상액·미발행 청구 예정액
      withdrawalAccountId: number | null; // CARD_SUBSCRIPTION 은 null(필요 금액에 별도 합산 안 됨), CARD_BILL 은 카드 출금 계좌
      prepared: boolean | null;           // 같은 출금 계좌의 오늘 이후 항목에 잔액 스냅샷을 날짜순 차감한 판정. 출금 계좌 없음·지난 항목은 null, 결제 완료 청구는 true
      shortage: number | null;            // prepared 와 같이 null. 결제 완료 청구는 0
    }[];
  }[];
};

// GET /fixed-expenses — 200, data 가 배열. 활성 고정지출을 등록 순으로. 동기화 항목(synced=true)은 수정·삭제 409 → FE 가 잠근다.
type FixedExpenseListResponse = {
  id: number; name: string; expenseType: ExpenseType;
  amount: number | null;              // 자동 감지 CARD_BILL 은 null(엔진 계산)
  isVariable: boolean;
  paymentDay: number;                 // 1..31 저장값(말일 보정 전)
  withdrawalAccountId: number | null; // Notion 은 필수로 적었지만 동기화 항목은 엔티티상 null(FixedExpense.sync 가 계좌를 넣지 않음)
  synced: boolean;
}[];

// POST /fixed-expenses — 201 · PUT /fixed-expenses/{id} — 200 (FR-PAY-07). PUT 은 같은 본문 전체로 교체(부분 수정 없음).
type FixedExpenseRequest = {
  name: string;                // 1..50
  expenseType: "RENT" | "SUBSCRIPTION" | "UTILITY" | "LOAN"; // CARD_BILL 은 400 PAY_004
  amount: number;              // 1 이상, 1,000원 단위 제한 없음. 변동형은 예상액
  isVariable?: boolean;        // 생략 시 false. 공과금은 true (FE 는 전체 교체라 늘 명시)
  paymentDay: number;          // 1..31
  withdrawalAccountId: number; // 본인의 관리 대상 계좌
};
type FixedExpenseResponse = { id: number };
// DELETE /fixed-expenses/{id} — 200, data null. 물리 삭제 없이 active=false(이체 기록 보존). 같은 내용 재등록은 새 행.
// 오류: 400 COMMON_001(입력) · 400 PAY_004(CARD_BILL) · 404 PAY_001(없음·타인·삭제됨, 구분 없음) · 404 ACCOUNT_001(계좌 없음·타인) ·
//       409 ACCOUNT_002(관리 대상 아님) · 409 PAY_002(동기화 항목 수정·삭제) · 409 PAY_003(등록 시 활성 항목과 5개 필드 일치)

// 2026-09-16 Notion 행 3개(이체 제안·이력 조회/승인·실행/나중에 하기) ↔ 백엔드 feature/41-approval-transfer(f75c20a) 코드 대조, 둘이 일치.
// ⚠️ develop(e0d364e, 9/15) 에는 아직 병합 전이라 Swagger 에 없다 — 병합되면 경로만 재확인하면 된다.

// 2026-09-16 저녁 -62(0adb3f5) 재대조: 목록이 **커서 페이지 `{ items, nextCursor }`** 로 바뀌고 month·cursor·size 가 붙었다. 단건 조회 GET /transfers/{id} 신설.
// GET /transfers?status=&month=&cursor=&size= — 200 (FR-PAY-03·08). 최신순(id 내림차순), 커서 = 마지막 항목 id, size 1~100 기본 20.
// month 는 **대상 출금일(dueDate) 기준** yyyyMM. 전부 선택이고 틀리면 400 COMMON_001. 앱: 캘린더는 해당 달로 좁혀 첫 쪽만, 승인 화면은 단건 조회.
type TransferListResponse = { items: TransferItem[]; nextCursor: number | null };
// GET /transfers/{id} — 200. 제안 한 건 + 감사 타임라인(오래된 순). 없거나 남의 것 404 PAY_005
type TransferDetailResponse = { transfer: TransferItem; history: { action: "EXECUTE" | "HOLD" | "FAIL" | "CANCEL"; basis: string; at: string }[] };
// -61(2026-09-16): 출금 건 하나에 제안은 한 번(취소·실행된 건은 재제안 없음, 재부족 알림은 P1). FAILED 만 부족액이 남으면 다음 08:30 에 PROPOSED 로 재개(번호·사유 초기화).
//   APPROVED 잔존 건은 30분 주기 배치가 같은 번호로 재전송한다 — 사용자 재승인과 같은 효과.
// 제안은 08:30 배치가 만든다: 캘린더 판정에서 출금일이 오늘·내일이고 shortage>0 인 항목마다 1건(수입 계좌 → 출금 계좌).
// 제안하지 않는 경우: 수입 계좌 없음 · 출금 계좌 = 수입 계좌 · 미발행 카드 예정액. 출금일 경과·부족액 해소는 CANCELED.
type TransferItem = {
  id: number; status: TransferStatus; // PROPOSED | APPROVED | EXECUTED | FAILED | CANCELED
  scheduledDate: string; // "2026-09-14" 실행 예정일(= 제안한 날)
  dueDate: string;       // ★ "2026-09-15" 대상 출금일. 고정지출·화~일 카드는 하루 뒤, 월요일 출금 카드는 같은 날
  requiredAmount: number; // 배치가 매일 갱신, 승인은 저장값으로 실행
  fromAccountId: number; toAccountId: number;
  purpose: { type: "FIXED" | "CARD_BILL"; fixedExpenseId: number | null; cardBillingId: number | null; name: string };
  executedAt: string | null; // EXECUTED 만 "2026-09-14T09:12:00"
  failReason: string | null; // FAILED 는 금융망 코드+사유, CANCELED 는 출금일 경과·부족액 해소
  createdAt: string;         // "2026-09-14T08:30:12"
}[];

// POST /transfers/{id}/approve — 200. 실행 직전 동의→1회 한도→1일 한도→계좌 자격 순 검사(하나라도 실패 시 이체 미실행 + 감사 HOLD + 403)
// ★ **APPROVED 도 승인할 수 있다** — 금융망 응답이 유실된 건이라 검사를 건너뛰고 **같은 기관거래고유번호로 재시도**한다.
//   이미 성공했으면 금융망이 중복(H1007)으로 답해 EXECUTED 가 되므로 이중 이체가 없다. 재시도 전용 API 는 없다(사본의 옛 /retry 는 실재하지 않음).
type ApproveTransferResponse = { id: number; status: "EXECUTED"; executedAt: string | null; failReason: string | null };
// 오류: 403 PAY_007(동의 꺼짐) · 403 PAY_008(1회 한도) · 403 PAY_009(1일 한도, 오늘 EXECUTED 합 포함) · 403 PAY_010(출금 계좌가 수입·관리 대상 아님) ·
//       404 PAY_005(없음·타인) · 409 PAY_006(PROPOSED·APPROVED 아님, 동시 승인의 두 번째) ·
//       422 PAY_011(잔액 부족, 금융망 A1014 → FAILED) · 422 PAY_012(은행 한도, A1016·A1017 → FAILED, 재시도 대상 아님) ·
//       503 FINANCE_004(3회 재시도 후. 제안은 APPROVED 유지 → 다시 승인하면 같은 번호로 재시도)
// POST /transfers/{id}/postpone — 200 본문 없음(data: null). 상태는 PROPOSED 그대로고 감사 로그에 HOLD 만 남는다.
//   ★ PROPOSED 만 받는다 — 404 PAY_005 · 409 PAY_006. 출금일이 지나면 08:30 배치가 CANCELED 로 정리한다.
// GET /cards/{id}/billings(P1) — 위 PAYMENT 절 CardBillingDetail (2026-09-17 대조)
```

### GAME

```ts
// ★ 2026-09-16 저녁 배포 서버 Swagger(/v3/api-docs, SSH 터널 18081) 와 직접 대조. 배포본 = develop 최신.
// ★ SlotType 은 서버 ItemSlotType: HEAD | FACE | UPPER_BODY | LOWER_BODY | SOCKS | FOOTWEAR (아바타) + WALL | FLOOR (가구).
//   앞서 쓰던 WALLPAPER·FURNITURE·HAIR·OUTFIT 은 옛 템플릿 값이라 폐기했다.

// GET /room — 200 (FR-GAM-01)
type RoomResponse = {
  avatar: {
    equipped: { userItemId: number; slotType: SlotType; itemId: number; assetKey: string }[];
    reaction: { type: string; until: string } | null; // 진행 중 반응 없으면 null. type 값 목록 미확정
  };
  furnitures: PlacedFurniture[];   // ★ 설치된 가구. 스텁이 아니라 실제 조회(2026-09-16)
  coin: { balance: number };
  attendance: { checkedToday: boolean };
  stickers?: { count: number; total: number; removableToday: boolean }; // P1
  overEnvelopes?: number[]; // P1 초과 봉투 id
};
// ★ `theme` 과 `board` 는 응답에 없다 — board 는 develop d80e569 에서 제거됐다. 벽 보드 수치는 GET /budgets/current 로 받는다.
//   FE 는 2026-09-16 에 RoomDto·Room 에서 둘 다 뺐다(화면에서 room.board 를 쓰던 곳은 없었다).

// ★ POST /fin-coins/attendance — 200 (FR-GAM-03). 경로가 `/attendance` 가 아니다(2026-09-16 정정, FE 수정 완료).
// 당일 첫 출석 10코인, 재요청도 200 이고 granted=0 · balance 는 최신 잔액. 금융망 연결과 무관. 404 USER_001.
type AttendanceResponse = { granted: number; balance: number };

// ★ 가구(방 3단계) — 2026-09-16 배포 확인
// GET /furnitures?slotType=FLOOR|WALL — 200. 보유 가구 전체 + 배치 상태. 미설치면 배치 필드가 null·layer 0
type UserFurniture = {
  userFurnitureId: number; itemId: number; name: string; slotType: "FLOOR" | "WALL"; assetKey: string;
  placed: boolean;
  placementStatus: "FLOOR" | "LEFT_WALL" | "RIGHT_WALL" | null;
  placementDirection: "FRONT_LEFT" | "FRONT_RIGHT" | null;
  positionX: number | null; positionY: number | null; layer: number;
  defaultFurnitureType: "FRIDGE" | "SOFA" | "TV" | null; // ★ V15(2026-09-18) 기본 가구 식별값. 일반 가구는 null
  canUnplace: boolean;                                   // ★ V15. 기본 가구는 false — 이동만 되고 해제는 409 FURNITURE_003
};
// PATCH /furnitures/{userFurnitureId} — 200, 응답은 UserFurniture 한 건.
//   { placed: true,  placementStatus, placementDirection, positionX, positionY, layer? }  설치·이동(앞 넷 필수, layer 생략 시 0)
//   { placed: false }                                                                      해제(배치 필드를 같이 보내면 400)
//   좌표는 소수 3자리까지. **일괄 엔드포인트는 없다 — 옮긴 가구마다 한 번씩 보낸다.**
//   오류: 400 COMMON_001(필수값·좌표 범위·정밀도) · 400 FURNITURE_002(가구 유형과 면 불일치) · 404 FURNITURE_001 · 409 FURNITURE_003(기본 가구 해제)
//   ⚠️ 계약 불일치(2026-09-21 확인): 서버 요청 검증이 **positionY ≤ 404**(`@DecimalMax("404")`, 옛 327×404 씬)인데 앱 씬은 2026-09-18 부터 327×586 이다.
//      바닥 대부분(y 286~586)이 404 를 넘어 실서버에서 그 자리 저장은 400 이 난다. 서버 수정 요청 — docs/game-items-seed-request.md §8.
//   placementDirection: 가구 그림이 방향별로 있어 앱이 받은 값대로 그리고 '방향 바꾸기'로 바꾼다(2026-09-21). 벽에 걸린 것은 붙은 벽이 정한다(LEFT_WALL=FRONT_RIGHT).
type PlacedFurniture = {
  userFurnitureId: number; itemId: number; slotType: "FLOOR" | "WALL"; assetKey: string;
  placementStatus: "FLOOR" | "LEFT_WALL" | "RIGHT_WALL";
  placementDirection: "FRONT_LEFT" | "FRONT_RIGHT";
  positionX: number; positionY: number; layer: number;
  defaultFurnitureType: "FRIDGE" | "SOFA" | "TV" | null; canUnplace: boolean; // ★ V15
};
// ★ 기본 가구(V15 `V15__default_furniture.sql`): 가입 시·기존 사용자 전원에게 fridge_default·sofa_default·tv_default 를 지급·설치한다(전부 FRONT_RIGHT).
//   상점에는 안 나온다(is_active=false). 초기 좌표는 옛 327×404 씬 값이라 앱이 가까운 빈 칸으로 당겨 그린다(scene.ts settlePlacements).

// ★ 착장 — 2026-09-16 배포 확인 (옛 기재 `PUT/DELETE /items/{userItemId}/equip` 는 폐기)
// GET /items?slotType= — 200. { userItemId, itemId, name, slotType, assetKey, equipped }[]
// PATCH /items/{userItemId} — 200, body { equipped: boolean }. 응답은 갱신된 착장 전체 { equipped: {userItemId,itemId,slotType,assetKey}[] }
//   같은 부위의 기존 아이템은 서버가 자동으로 벗긴다. 같은 상태를 다시 보내도 성공(멱등). 오류: 400 COMMON_001 · 404 USER_001·ITEM_001(보유 아이템 없음).
//   앱 구현(2026-09-20): features/room 의 items.ts(변환·부위 필터·착장 반영) · api/item.api.ts · queries(useUpdateItemEquipment) · WardrobeScreen(옷장). 문구는 features/room/errors.ts.

// ★ 코인 — 경로가 `/coins` 가 아니라 `/fin-coins` 다 (2026-09-16)
// GET /fin-coins/balance — 200 { balance }
// GET /fin-coins?cursor=&size= — 200 (FR-GAM-08, PAGE-30 P1). 2026-09-17 develop FinCoinController 대조 → 구현. id 내림차순, size 기본 20(1~100), 오류 400 COMMON_001 · 404 USER_001.
//   delta 는 적립 +·사용 −, balanceAfter 는 반영 후 잔액, reasonText 는 서버 enum 문구(ATTEND 출석 보상 · CONFIRM_ALL 거래 내역 전체 확인 보상 · WEEKLY 주간 보상 · MONTHLY 월간 보상 · PURCHASE 아이템 구매), grantDate 는 "yyyy-MM-dd"
type CoinLedgerResponse = {
  items: { id: number; delta: number; balanceAfter: number; reasonCode: CoinReason; reasonText: string; grantDate: string }[];
  nextCursor: number | null;
}; // reasonCode: ATTEND | CONFIRM_ALL | WEEKLY | MONTHLY | PURCHASE. ★ 잔액은 이 응답에 없다(balance 는 따로 조회)
//   2026-09-18: 상점 구매가 들어와 PURCHASE 원장이 실제로 쌓이기 시작했다 — delta = −가격, refId = itemId(문자열), grantDate 는 구매일(KST).

// ★ 상점 — 2026-09-18 develop(f3d1b15 `feature/148-shop-items-purchase-api`)·배포 서버 대조. 옛 기재(노션 ShopResponse/PurchaseResponse)와 여러 군데 다르다.
// GET /shop?itemCategory=&slotType= — 200 (FR-GAM-05). ★ data 가 객체가 아니라 **배열**이다(`{items:[...]}` 아님).
//   두 파라미터는 선택이고 enum 에 없는 값이면 400 COMMON_001. 같이 주면서 조합이 안 맞으면 400 COMMON_001(예: AVATAR + FLOOR).
//   판매 중(is_active)인 것만 오고 owned 는 지금 사용자의 보유 여부다(아바타는 user_items, 가구는 user_furnitures 를 같이 본다).
type ShopItem = {
  itemId: number;                        // ★ `id` 가 아니라 `itemId`
  itemCategory: "AVATAR" | "FURNITURE";  // ★ 신설
  slotType: SlotType;                    // 가구 FLOOR·WALL / 아바타 HEAD·FACE·…
  name: string; price: number;           // price 0 이면 무료
  assetKey: string;
  themeCode: string | null;              // ★ 상시 상품이면 null
  owned: boolean;
};

// POST /shop/purchase — 200. 사용자 행을 FOR UPDATE 로 잠근 뒤(출석과 같은 잠금) 최신 원장의 balanceAfter ≥ 가격을 검증하고,
//   보유 내역 1건과 코인 사용 원장 1건(delta = −가격, reasonCode = PURCHASE, refId = itemId)을 남긴다.
type PurchaseRequest = { itemId: number };
type PurchaseResponse = {
  itemId: number;
  itemCategory: "AVATAR" | "FURNITURE";
  userItemId: number | null;             // ★ 아바타를 샀을 때만
  userFurnitureId: number | null;        // ★ 가구를 샀을 때만 — 이 값이 GET /room·/furnitures 의 userFurnitureId 다
  price: number;                         // 실제 결제 가격
  balance: number;                       // 구매 직후 잔액
};
// 오류: 404 SHOP_001 판매 중인 상품 없음 · 409 SHOP_002 이미 보유 · 409 SHOP_003 코인 부족 · 500 SHOP_004 가격 오류(price < 0)
// 앱 구현(2026-09-20): features/shop 의 model(변환·탭·구매 가능 판정) · shop.api · queries(usePurchaseShopItem) · ShopScreen(PAGE-29). 문구는 features/shop/errors.ts.
// ⚠️ **판매 상품 행은 들어왔으나 전부 비활성이다**(2026-09-21 오후, develop 66011de) — V19 의상 3종(`outfit_epic_mage` 500 ·
//    `outfit_legendary_paladin` 1000 · `outfit_mythic_dragon` 2000, 모두 AVATAR·UPPER_BODY) · V20 가구 56종이 `is_active = FALSE` 로 등록됐다.
//    GET /shop 은 `active = true and defaultFurnitureType is null` 만 주므로 실서버 상점은 여전히 옷·가구 모두 비어 있다.
//    앱 키는 서버와 맞췄다 — 의상 3종 일치(features/room/outfits.ts), 가구 56종 전부 앱 스프라이트 키에 있음(서버에만 있는 키 0개).
//    앱에만 있는 것은 기본 가구를 그리는 오리지널 3종(sofa·refrigerator·tv_set `_original`)뿐이다 — V20 이 뺀 탁상 소품 10종·작은 화분 4종은
//    앞으로도 넣지 않기로 해 앱에서 지웠다(사용자 결정 2026-09-21). 목의 이름·가격도 V19·V20 값이고 계약 사본은 api/mocks/shop-seed.ts 다.
//    판매 개시(V21) 요청은 docs/game-items-seed-request.md §4.
//    앱은 가구 분류(침대·소파 …)를 assetKey 로 방 카탈로그에서 찾는다 — 서버에 분류 필드는 필요 없다.

// POST /room/stickers/remove — 200 (FR-GAM-06). 하루 1개
type RemoveStickerResponse = { removed: number; count: number };

// GET /themes, PUT /room/theme — P2, 상세 미확인
```

### NOTIFICATION

```ts
// ★ 2026-09-17 배포 서버 Swagger + develop e21c9dd(feature/49-fcm-setup) 코드 대조. `POST /devices` 는 없다 — 아래 두 개로 바뀌었다.
// PUT /me/push-devices/{installationId} — 200, data: null (FR-NTF-01). 등록·갱신 겸용(멱등).
//   installationId: 앱 설치마다 앱이 만들어 기기에 보관하는 UUID(하이픈 있는 표준 36자, 대소문자 무관). 형식이 아니면 400 COMMON_001.
//   같은 installationId 면 사용자·토큰을 덮어쓰고, 같은 토큰이 다른 설치에 묶여 있으면 그 연결을 해제한다(계정 전환·재설치 대응).
//   오류: 400 COMMON_001/002 · 404 USER_001(활성 사용자 없음) · 409 PUSH_001(동시 변경 충돌, 서버가 3회 재시도 후 — 앱은 재시도 가능)
type PushDeviceRequest = {
  token: string;      // FCM 등록 토큰. 공백 불가, 최대 2048자, 출력 가능한 ASCII(0x21~0x7E)만
  platform: "ANDROID"; // 서버 정규식이 ANDROID 만 허용(iOS 없음)
};
// DELETE /me/push-devices/{installationId} — 200, data: null. 로그아웃 때 호출. 본인 설치만 비활성화하고,
//   다른 계정 소유·이미 해제된 설치여도 200(멱등). 오류: 400 COMMON_001(UUID 형식) · 409 PUSH_001
// 2026-09-17 Notion 행 대조(사용자 붙여넣기): 「FCM 토큰 등록·갱신」은 본문 { fcmToken } · 개별 에러 없음으로 코드와 다르다
//   (코드: 경로 installationId + { token, platform } · 400/404 USER_001/409 PUSH_001). 「FCM 토큰 삭제」 행은 로그인 예시 템플릿 그대로(미작성).
//   → 앱은 배포 서버(코드) 기준으로 구현한다. Notion 수정은 담당자 몫.
// Notion 「FCM data 메시지 규약」(발송 코드가 없어 코드 대조 불가) — data.type → data 필드:
//   CLASSIFY_QUESTION(transactionId, merchantName, amount, suggestedSubcategoryId) · BUDGET_ALERT(envelopeId, threshold 50/30/10/5/0)
//   TRANSFER_REQUEST(transferId, amount, purposeName, scheduledDate) · COACHING(coachingLogId, message) · REACTION(reactionType, durationSec)
//   CLEANUP(pendingCount) · NEW_LINK_FOUND(kind ACCOUNT/CARD, name) · PAYMENT_RISK(fixedExpenseId, name, shortage, paymentDate) · COIN_GRANTED(reasonCode, granted, balance)
//   알림함 type(5종)과 이름이 다르다: 미납 경고가 알림함은 WARNING, 푸시는 PAYMENT_RISK. 푸시에만 CLASSIFY_QUESTION·REACTION·NEW_LINK_FOUND·COIN_GRANTED.
// 발송 쪽(FcmSender): notification{title, body} + data(Map<string,string>), Android 채널 id "default" 고정
//   → 앱은 "default" 알림 채널을 만들어야 한다. 발송을 호출하는 코드는 아직 없어 data.type 값 목록은 여전히 미확인(TBD).

// ★ 2026-09-17 develop 5738742(feature/70-notification-CR-api 머지) NotificationController 코드 대조 → PAGE-28 구현.
// GET /notifications?unreadOnly=&cursor=&size= — 200 (FR-NTF-02). id 내림차순만(requiresAction 정렬 없음), size 기본 20·1~100,
//   cursor 는 직전 nextCursor(1 이상), 조회만으로 읽음 처리하지 않음. 오류: 400 COMMON_001.
type NotificationListResponse = {
  items: {
    id: number;
    type: "COACHING" | "BUDGET_ALERT" | "TRANSFER_REQUEST" | "CLEANUP" | "WARNING"; // 필드명은 notiType 이 아니라 type
    title: string;             // 최대 100자
    body: string | null;
    refId: string | null;      // 최대 30자, 서버는 뜻을 정하지 않음(생성하는 쪽이 넣음). 앱은 명세대로 TRANSFER_REQUEST=이체 id · BUDGET_ALERT=봉투 id 만 쓴다
    requiresAction: boolean;   // 읽음 처리·이체 승인으로 바뀌지 않는다
    isRead: boolean; createdAt: string; // "2026-09-16T22:00:00" (KST, 시간대 없음)
  }[];
  nextCursor: number | null;
};
// PATCH /notifications/{id}/read — 200, data: null. 본문 없음, 이미 읽은 알림도 성공(멱등). 남의 것·없음 404 NOTI_001 · id 형식 400 COMMON_001.
//   ⚠ 명세 표의 `PUT .../read`·`PUT /notifications/read-all` 과 다르다 — 메서드는 PATCH, 전체 읽음 API 는 없다.
// 알림 생성(NotificationService.create)을 부르는 코드는 아직 없다(2026-09-17) → 실서버 알림함은 비어 있고 앱은 목으로 확인한다.
// GET·PUT /settings/notifications — 200 (FR-NTF-03). 2026-09-20 배포 서버 Swagger 대조.
//   ★ PUT 응답은 **본문 없음**(UserSettingsController ResponseEntity<Void>, 2026-09-22 코드 확인) — 아래 타입은 GET 응답·PUT 요청이다. 앱은 PUT 뒤 GET 을 다시 부른다.
type NotificationSettings = {
  notiCoaching: boolean; notiBudgetAlert: boolean; notiTransfer: boolean; notiCleanup: boolean; // PUT 은 네 개가 필수(부분 수정 없음)
  quietHoursStart: string | null;   // "23:00:00" (LocalTime). 쓰지 않으면 null
  quietHoursEnd: string | null;     // 두 쪽을 함께 null 로 보내면 방해 금지 해제. 자정을 지나는 범위도 허용
};
// 오류: 400 COMMON_001 · 400 USER_009(방해 금지 범위) · 404 USER_001·USER_006(사용자 설정 없음)

// GET·PUT /settings/coach — 200. { coachPersona: "PLAIN" | "DODO" | "ONSOON" | "JIBANG" } — PUT 응답도 **본문 없음**(2026-09-22, 위와 같음)
//   ★ 열거형 표의 CoachPersona 3종에 PLAIN 이 더 있다(2026-09-20 Swagger). 오류: 400 COMMON_001(누락)·COMMON_002(지원하지 않는 값)
// 앱 구현(2026-09-20): features/settings 의 model(변환·방해 금지 검사) · settings.api · queries(즉시 저장, 낙관적 반영 후 실패 시 롤백) · SettingsScreen 의 '알림'·'코치 말투' 구역.
```

### COACHING

```ts
// 배포 서버 Swagger `코칭 대화` 태그 · 백엔드 develop CoachingChatController(a903cdc, 2026-09-21)로 2026-09-22 대조. 옛 기재 `{ reply, coachingLogId }` 는 틀렸다.
// 2026-09-23 develop(0768a167) 재대조: chartId·rows·totalKrw·numericRows 필드, 차트 HTML 중계 경로, AI_002·AI_003 이 확정됐다(아래 반영).
// 세션은 백엔드가 사용자당 하나 관리한다(24시간 · 질문 20회). 만료되면 다음 질문에서 새 세션으로 이어지며 앱은 세션 id 를 받지 않는다.
// 컨트롤러는 서버 환경변수 coaching.api.token 이 있을 때만 켜진다 — 배포 Swagger 에 경로가 있으므로 실서버는 켜져 있다.

// POST /coaching/chat — 200 (FR-AI-04, P1). 코치에게 질문 한 턴
type ChatRequest = { message: string }; // @NotBlank @Size(max 2000). 비었거나 초과하면 400 COMMON_001
type ChatReply = {
  reply: string;
  kind: "CHAT" | "COACHING"; // CHAT = 금융 개념·소비 조회·안내, COACHING = 예측·위험 코칭
  // 코칭 서버 값 그대로. COACHING 은 항상 "answered". CHAT 은 아래 중 하나 —
  // answered · needs_source(근거 자료 없음) · needs_data(개인 자료 부족) · needs_clarification(지원하지 않는 기간·필터) · out_of_scope(금융 외) · unavailable(모델 실패, fallbackReason 참고)
  status: string;
  source: string; // llm(모델 문장) · template(안내 문구) · engine(확정 원장 집계)
  fallbackReason: string | null;
  answerId: string; // 코칭 서버 답변 id(문자열). 숫자 coachingLogId 가 아니다
  chartId: string | null; // 예측·구매 검토 답변에 딸린 예산 차트 id → GET /coaching/charts/{chartId}/html. 그 외 null
  rows: { envelope: string; totalKrw: number; count: number }[]; // 소비 조회 답변의 봉투별 집계. 그 외 빈 배열
  totalKrw: number | null; // 소비 조회 합계. 그 외 null
  // 위험(risk)·가정(what_if) 코칭 답변의 봉투별 표 데이터(ai/coaching/docs/chat.md numeric_rows). 그 외 null. 값은 엔진 산출값 그대로
  numericRows: {
    mode: string; // "risk" | "what_if"
    envelopeSpend: { envelope: string; p10Krw: number; p50Krw: number; p90Krw: number }[]; // 두 모드 모두. 근거 없으면 []
    budgetRisk: { envelope: string; budgetKrw: number; observedUsedKrw: number; projectedUsedP50Krw: number; pOverBudget: number }[]; // risk + 예산 있을 때만. 없으면 []. pOverBudget 0~1
  } | null;
};
// 구매 검토 되묻기(금액·봉투·결제 수단·시점이 빠짐)는 오류가 아니라 200 status "needs_clarification" 이고 reply 에 후속 질문 문장이 온다.
//   fallbackReason 이 원 코드: purchase_amount_required · purchase_envelope_required · purchase_payment_method_required · purchase_installment_unsupported · purchase_date_required
// 오류: 400 COMMON_001 · 422 AI_003(코칭 서버가 질문을 거절 — 같은 질문을 다시 보내도 같다) · 503 AI_001(코칭 서버 응답 없음)

// GET /coaching/chat — 200. 현재 세션 대화 이력. 세션이 없거나 만료됐으면 messages 빈 배열 · expiresAt null
type ChatHistoryResponse = {
  messages: { role: "user" | "assistant"; content: string; chartId: string | null }[]; // 코칭 서버 role 그대로(user · assistant). 이력에는 rows·totalKrw·numericRows 가 없다
  expiresAt: string | null; // "YYYY-MM-DDTHH:mm:ss" KST(공통 규약). Swagger 는 date-time 으로 표기하지만 서버 LocalDateTime 직렬화라 오프셋이 없다
};
// 오류: 503 AI_001
// 앱 구현(2026-09-22): features/coaching 의 model(kind·status·source·role 유니온 + UNKNOWN, 2000자 검사, 이력에 턴 붙이기) · coaching.api · queries(이력 조회, 질문 뮤테이션은 재시도 없음·성공 시 이력 캐시에 붙임) · errors(AI_001 문구) · components/CoachingChatScreen(PAGE-31, 같은 날 구현 — 홈 코치 고양이 탭으로 진입).

// ── 예산 예측 차트 (2026-09-22 팀 결정: AI 서버 차트를 **HTML 로** 받는다 → 2026-09-23 백엔드 develop 으로 경로·필드 확정) ──
// AI 서버(ai/coaching/docs/charts.md): POST /v1/charts/budget-forecast(backend 토큰·Idempotency-Key 필수 → 앱이 직접 못 부름) 로 만들고
// GET /v1/charts/{id}/html 이 script·style 인라인의 자기완결 페이지(약 50KB, 라이트 전용)를 준다. 백엔드는 답변 id 를 멱등키로 차트를 만들어 chartId 를 채운다(실패해도 답변은 온다).
// GET /coaching/charts/{chartId}/html — 200 text/html(봉투 없음) · 404 AI_002(없거나 다른 계정) · 422 AI_003 · 503 AI_001.
// 앱 구현(2026-09-22): coaching.api.getChartHtml(text 로 받음) · queries.useChartHtml(404 재시도 없음) · model.parseChartId/toChartHtml ·
//   components/ChartHtmlView(react-native-webview 13.16.1, 웹은 srcdoc iframe) · CoachingChartScreen · 라우트 /coaching/chart/[chartId].
//   목: api/mocks/coaching-chart.ts 의 MOCK_CHART_ID 하나만 200, 나머지 404. 제안 1 은 앱에 미리 반영(ChatReplyDto·ChatMessageDto 의 선택 필드 chartId,
//   목 COACHING 답변에 붙임) — 코치 답변 아래 '예산 예측 차트 보기' 버튼이 /coaching/chart/{chartId} 로 간다. 백엔드가 다른 이름으로 주면 model 만 고친다.
```

## 4. 열거형과 기준 데이터 (ERD v0.1)

클라이언트 타입은 아래 값의 유니온으로 두고, 모르는 값은 `UNKNOWN` 으로 흡수해 화면이 깨지지 않게 한다(규칙 90).

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `TxType` | `CARD` `DEPOSIT` `WITHDRAW` `TRANSFER` `CARD_BILL` | DEPOSIT 은 분류 대상 아님(수입). CARD_BILL 은 카드대금 계좌 출금(백엔드 공지 2026-09-22) |
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
