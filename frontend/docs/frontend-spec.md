# KeyFin 프론트엔드 기능 명세

> **원천**: 팀 Notion(A408) — [서비스 기획](https://app.notion.com/p/0e7f938dd4cd83fbbd22818f3945992d) · [요구사항 명세서 v0.1](https://app.notion.com/p/359f938dd4cd83a3835c815bdafbc7d2) · [기능 명세서 v0.2(P0)](https://app.notion.com/p/8baf938dd4cd83489efb012fa2d53b41) · [ERD v0.1](https://app.notion.com/p/ERD-033f938dd4cd820bbdd0812e6ee6f389) · [API 명세서](https://app.notion.com/p/API-036f938dd4cd82a9990b81e44d571c24) · [미결 사항 정리(2026-09-07)](https://app.notion.com/p/3d4f938dd4cd8088a6a1d6ac6ccd2032). 2026-09-08 기준으로 대조했다.
> 백엔드 팀이 쓴 Notion 문서가 진실이고 이 문서는 **프론트 관점 요약**이다. 둘이 다르면 Notion 이 이기고 이 문서를 고친다. `AGENTS.md` 의 "명세에 없는 기능 추가 금지" 규칙에서 말하는 명세가 이 문서다.
> 우선순위: **P0** = MVP 최소, **P1** = 기간 내 완성 목표, **P2** = 확장(로드맵). 화면·API 는 P0 부터 만들고, P1 은 P0 시연 시나리오가 끝난 뒤, P2 는 요청 전까지 만들지 않는다.

## 0. 서비스와 사용자

- **KeyFin** — 소비 내역을 자동 수집·분류해 카테고리별 예산(봉투 7종)을 안내하고, 정기 지출을 위한 결제 계좌 준비 이체를 승인 기반으로 실행하며, 방·캐릭터·코인으로 습관을 지속시키는 생활 금융 관리 앱.
- **사용자 유형은 1종**(일반 사용자). 관리자·중개사 같은 역할 분기가 없으므로 권한 매트릭스는 두지 않는다. 인증 전 화면은 로그인·회원가입뿐이고 나머지 모든 화면·API 는 로그인 필수.
- **플랫폼**: Android 앱, APK 직접 배포(NFR-USR-02). iOS 는 범위 밖(코드로 막지는 않되 검증하지 않는다).
- **금융 데이터 원천**: SSAFY 금융망 API. 과거 거래는 백엔드가 원장에 시딩(SEED)하고 실시간 거래는 1분 폴링(LIVE)으로 수집한다. 프론트는 금융망을 직접 호출하지 않는다.
- **시연 시나리오(P0 최소 집합)**: 온보딩 → 예산 제안 → 결제 → 봉투 차감·아바타 반응 → 코칭 → 결제 준비 이체 승인 → 코인.

## 1. 기능 ID 표 (도메인별)

열 설명 — **FE**: `화면` = 프론트가 화면을 만든다 / `표시` = 백엔드가 계산·발생시키고 프론트는 결과만 보여준다 / `없음` = 백엔드 전용. **API** 는 `docs/api-contract.md` 의 경로(접두 `/api/v1` 생략).

### USR — 계정·연동·온보딩

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-USR-09 | 회원 탈퇴 | P1 | 화면 | `DELETE /users/me` | 마이 탭 로그아웃 아래 '회원 탈퇴' → 확인 창에서 사라지는 것(소비 내역·예산·방)과 재가입 불가를 알리고 **현재 비밀번호**를 받아 보낸다. 성공하면 세션을 끝내 로그인으로 간다(2026-09-20 구현) |
| FR-USR-01 | 회원가입·로그인 | P0 | 화면 | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh` | 가입 시 백엔드가 기본 헤어·옷·표정 3종을 지급·장착. 탈퇴 계정 이메일 재가입 불가 |
| FR-USR-02 | 계좌·카드 연결(opt-in) | P0 | 화면 | `GET /links/candidates`, `POST /links` | 이미 연결된 항목 재선택은 무시(멱등). 후보 0건이면 "연결할 계좌가 없어요" + 시연 셋업 안내 |
| FR-USR-03 | 수입 계좌 지정 | P0 | 화면 | `GET /accounts`, `PUT /accounts/{id}/income` | 사용자당 1개, 기존 것은 자동 해제 |
| FR-USR-04 | 온보딩 소비 분석 | P0 | 화면 | `POST /budgets/proposals` | 연결 직후 10초 내 "지난 소비를 분석했어요" → 예산 제안 화면 |
| FR-USR-05 | 연결 관리(추가·해제) | P1 | 화면 | `DELETE /links/accounts/{id}`, `DELETE /links/cards/{id}` | |
| FR-USR-06 | 계정 관리 | P1 | 화면 | `POST /auth/logout`, `PUT /auth/password`, `DELETE /users/me` | |
| FR-USR-07 | 설정(코치 말투·이체 동의·한도) | P1 | 화면 | `GET/PUT /settings/transfer`, 코치 말투 `PUT`(URL 미확인) | 이체 동의·한도(FR-PAY-04 입력)는 P0 API |

### TXN — 거래 수집·분류

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-TXN-01 | 거래 주기 수집(폴링) | P0 | 없음 | — | 결제 → 원장 반영 90초 이내. 프론트는 재조회·푸시로 결과만 받는다 |
| FR-TXN-02 | 지출 자동 분류 | P0 | 없음 | — | 등록 가맹점은 AUTO 확정, 미등록·계좌 출금은 PENDING |
| FR-TXN-03 | 분류 확인 질문 | P0 | 화면 | `GET /transactions/pending`, `GET /subcategories`, `PUT /transactions/{id}/classification` | 방의 코치 말풍선 + 푸시. [외식 확정] / [다른 카테고리] → 세분류 22종 시트 + 제외 태그. 질문에서 확정까지 탭 2회 이내 |
| FR-TXN-04 | 미응답 일괄 정리(저녁 세션) | P1 | 화면 | `GET /transactions/pending`, `PUT /transactions/classifications` | 전건 확정 시 일 코인 +30 |
| FR-TXN-05 | 예산 조정 태그(더치페이·내 계좌 이동·비상금) | P1 | 화면 | `PUT /transactions/{id}/classification` (`excludeTag`) | API 는 P0 분류 확정에 포함돼 있음 |
| FR-TXN-06 | 결제 취소 반영 | P1 | 표시 | — | `status=CANCELED` 뱃지 |
| FR-TXN-07 | 사용자 응답 학습 | P2 | 없음 | — | |
| FR-TXN-08 | 거래 메모 | P2 | 화면 | `PUT /transactions/{id}/memo` | |
| FR-TXN-09 | 거래 내역 조회 | P0 | 화면 | `GET /transactions` | 월·봉투·세분류·계좌·카드 필터, 커서 페이지. CANCELED·제외 태그도 숨기지 않고 뱃지로 |
| FR-TXN-10 | 세분류·매핑 관리 | P0 | 없음 | — | 시스템 데이터, 사용자 편집 없음 |

### BGT — 예산 봉투

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-BGT-01 | 카테고리별 예산 제안 | P0 | 화면 | `POST /budgets/proposals` | 최근 3개월 평균 기반 결정론 계산. 제안 7건 + 근거(월평균) 표시 |
| FR-BGT-02 | 예산 승인·조정 | P0 | 화면 | `PUT /budgets/{budgetId}/confirm` | 봉투 7개 전부 전송. 승인 없이 월 시작 시 "예산 미설정" 상태 + 홈 승인 유도 배너 |
| FR-BGT-03 | 봉투 차감 | P0 | 없음 | — | 잔액은 서버 파생 계산. 클라에서 재계산 금지 |
| FR-BGT-04 | 잔여 예산 상시 표시 | P0 | 화면 | `GET /budgets/current`, `GET /room` | 방 벽 보드: 전체 진행률 + 봉투 7종 바. 탭 → 봉투 상세 |
| FR-BGT-05 | 잔액 구간 알림 | P0 | 표시 | 푸시(`BUDGET_ALERT`) | 잔여율 50/30/10/5/0% 하향 통과 시 월 1회. 보드 깜빡임 연출 |
| FR-BGT-06 | 카드 청구 예정액 | P1 | 화면 | `GET /cards/{id}/billings` | PAGE-33 (2026-09-17 구현) |
| FR-BGT-07 | 월간 소비 리포트 | ~~P1~~ 제외 | — | `GET /reports/{month}` | **구현하지 않기로 결정(2026-09-23 사용자 결정)** — 리포트 탭을 뺐다. 예산 확정 전 월은 404 |
| FR-BGT-08 | 다음 달 예산 조정 제안 | P1 | 화면 | `POST /budgets/proposals` (basis=전월 실적, `adjustment`) | |
| FR-BGT-09 | 비상금 설정 | P1 | 화면 | `PUT /budgets/{budgetId}/emergency` | 가상 풀. 값은 `GET /budgets/current` 의 `emergency` 로도 온다. PAGE-12 봉투 목록 아래 '비상금' 구역으로 2026-09-20 구현 — 남은 금액(음수면 빨강)·설정·사용 표시 + 금액 입력·저장, 1,000원 단위·0 이면 해제. 봉투 잔액·이체에는 영향이 없어 확인 창을 두지 않는다 |
| FR-BGT-10 | 절감 포인트 안내 | P2 | 화면 | `GET /savings/insights` | |

### PAY — 정기 지출·결제 준비

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-PAY-01 | 정기 지출 통합 일정 | P0 | 화면 | `GET /payments/calendar` | 방 캘린더: 날짜별 출금 예정(이름·금액·준비 상태 뱃지). 준비 상태는 FR-PAY-02 전까지 null 이라 뱃지를 그리지 않는다. 금융망 카드 정기결제(`CARD_SUBSCRIPTION`)는 수정 불가 |
| FR-PAY-02 | 필요 금액 계산 | P0 | 표시 | (캘린더 응답의 `prepared`·`shortage`·`estimated`) | 매일 06:00 배치 |
| FR-PAY-03 | 승인 기반 자동 이체 | P0 | 화면 | `GET /transfers`, `POST /transfers/{id}/approve`, `POST /transfers/{id}/postpone` | 07:00 제안 푸시(`TRANSFER_REQUEST`, `refId`=이체 ID) → 승인 화면 직행 |
| FR-PAY-04 | 이체 안전장치 | P0 | 화면·표시 | `GET/PUT /settings/transfer` | 동의 OFF 면 이체 실행 경로 자체를 노출하지 않는다. 검사 실패 사유는 알림·`failReason` 으로 |
| FR-PAY-05 | 미납·연체 위험 알림 | P1 | 표시 | 푸시(`WARNING`) | |
| FR-PAY-06 | 이체 실패 처리 | P1 | 화면 | `POST /transfers/{id}/approve` 재호출 | retry 엔드포인트는 없다 |
| FR-PAY-07 | 고정지출 수동 등록·수정·삭제 | P0 | 화면 | `GET/POST/PUT/DELETE /fixed-expenses` | 출금일 29~31 + 없는 달은 말일 보정(서버). 동기화 항목(`synced`)은 수정·삭제 409 PAY_002 라 잠금, `CARD_BILL` 은 직접 등록 불가(400 PAY_004) |
| FR-PAY-08 | 이체 이력 조회 | P1 | 화면 | `GET /transfers?status=EXECUTED` | |
| FR-PAY-09 | 공과금 관리 | P2 | 화면 | `POST /fixed-expenses` (`expenseType=UTILITY`, `isVariable=true`) | |

### GAM — 방·캐릭터·코인

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-GAM-01 | 방 홈 화면 | P0 | 화면 | `GET /room` | 가을 테마 1종 + 벽 보드·캘린더·아바타·코치. 요소 탭 = 기능 진입. 방 진입 1초 내 실제 데이터 렌더링 |
| FR-GAM-02 | 아바타 카테고리 반응 | P0 | 표시 | `GET /room` (`avatar.reaction`) | 봉투→반응 매핑(쇼핑=쇼핑백 등)은 소품 오버레이, 착장 유지. 결제 → 90초 내 반응. 프론트 구현은 파츠 에셋·`reaction.type` 확정 뒤(§6 #8) |
| FR-GAM-03 | 일 코인 지급 | P0 | 화면·표시 | `POST /attendance` | 당일 첫 진입 +10(중복이면 `granted=0`), 전건 확정 +30 은 자정 배치 |
| FR-GAM-04 | 주·월 코인 | P1 | 표시 | `GET /fin-coins` | 주 200(예산 잔여), 월 최대 1,000(공식 미결) |
| FR-GAM-05 | 방·캐릭터 꾸미기 | P1 | 화면 | `GET /shop`·`POST /shop/purchase`(2026-09-18 배포, 2026-09-20 상점 PAGE-29 구현), `GET /items`, `PATCH /items/{userItemId}`(2026-09-20 옷장 구현, 2026-09-21 세트로 전환 — 부위 탭 없이 세트 목록, 눌러서 바로 입고 벗기, 서버가 같은 부위를 자동 해제하므로 응답 착장으로 목록을 맞춘다) | 슬롯 유형: 캐릭터 HEAD/FACE/UPPER_BODY/LOWER_BODY/SOCKS/FOOTWEAR, 방 WALL/FLOOR(2026-09-16). **옷은 부위별 파츠가 아니라 세트 한 벌이다(사용자 결정 2026-09-21)** — 머리·상의·하의·신발이 한 장에 같이 그려진 캐릭터 이미지라 부위를 겹쳐 그릴 수 없다. 서버는 세트를 `AVATAR`·`UPPER_BODY` 로 내려 주고(DB CHECK 가 SET 을 허용하지 않으며 백엔드는 고치지 않는다) 앱이 화면에서만 '세트'로 부른다. 하의·양말 등 나머지 부위는 쓰지 않는다 |
| FR-GAM-06 | 예산 초과 연출 | P1 | 화면 | `GET /room` (`stickers`, `overEnvelopes`), `POST /room/stickers/remove` | 전체 초과 시 압류 딱지 7개, 하루 1개 제거 |
| FR-GAM-07 | 방 테마 확장 | P2 | 화면 | `GET /themes`, `PUT /room/theme` | |
| FR-GAM-08 | 코인 잔액·이력 | P1 | 화면 | `GET /fin-coins/balance`, `GET /fin-coins` | "왜 받았는지"(`reasonText`) 포함 — PAGE-30 (2026-09-17 구현) |

### AI — 코칭

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-AI-01 | 우려 결제 감지 | P0 | 없음 | — | 거래액 ≥ 봉투 잔액 × 50% 규칙 |
| FR-AI-02 | 코칭 멘트 생성 | P0 | 표시 | 푸시(`COACHING`) + 알림함 | MVP 는 평문 프롬프트 1종. 숫자는 엔진 산출값만 |
| FR-AI-03 | 애매 상황 LLM 판단 | P1 | 없음 | — | |
| FR-AI-04 | 코칭 대화 | P1 | 화면 | `POST /coaching/chat` | |
| FR-AI-05 | 지원 정책 추천 | P2 | 화면 | `GET`(URL 미확인) | |
| FR-AI-06 | 금융 상품 추천 | P2 | 화면 | `GET`(URL 미확인) | |

### NTF — 알림

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-NTF-01 | 푸시 알림 | **P0**(승격, 팀 결정 2026-09-07) | 화면 | `PUT /me/push-devices/{installationId}`, 로그아웃 시 `DELETE` | 로그인 시 FCM 토큰 등록·갱신(설치 UUID 는 앱이 보관). 앱 미실행 상태에서 푸시 탭 → 해당 화면 직행(딥링크) — **토큰 등록·갱신·해제 구현(2026-09-17)**: `(app)` 레이아웃에서 로그인 동안 등록(앱 실행마다 PUT, FCM 토큰 갱신 시 재등록), 로그아웃 전 DELETE, 설치 UUID 는 expo-crypto 로 만들어 SecureStore 보관, 알림 권한은 탭 진입 후 설치당 1회. **포그라운드 표시 구현(2026-09-20 사용자 결정)**: 앱을 보고 있는 동안 온 푸시도 백그라운드와 같은 OS 배너로 띄우고(`setNotificationHandler`) 종류별로 관련 쿼리를 무효화한다 — 방 연출 `REACTION`·`COIN_GRANTED` 만 배너 없이 데이터만 갱신. **푸시 탭 딥링크 구현(2026-09-20)**: 앱이 떠 있는 동안의 탭은 구독으로, 꺼져 있다 푸시로 켜진 경우는 마지막 응답을 실행당 1회 읽어 아래 §3 매핑대로 이동한다(`usePushDeepLink`). 로그아웃 상태로 들어오면 로그인 뒤 대상 화면으로 간다 |
| FR-NTF-02 | 알림함 | P1 | 화면 | `GET /notifications`(커서·`unreadOnly`), `PATCH /notifications/{id}/read` — 전체 읽음 API 없음(develop 5738742, 2026-09-17) | PAGE-28 (2026-09-17 구현). 안 읽은 `requiresAction` 건에 "확인 필요" 뱃지, 탭 → 읽음 처리 후 §3 표 대상 화면 |
| FR-NTF-03 | 알림 설정 | P1 | 화면 | `GET·PUT /settings/notifications` | 유형별 on/off(코칭·예산·이체·정리 4종), 방해 금지 시간. PAGE-27 안의 '알림' 구역으로 2026-09-20 구현 — 토글·시간은 누르는 즉시 저장(부분 수정이 없어 설정 전체를 보낸다), 방해 금지는 30분 간격 선택창 두 개이고 끄면 두 쪽을 null 로 보낸다 |

## 2. 화면 목록

라우트는 Expo Router 경로. **Pencil** 열은 `design/design-map.json` 의 노드 id 이며 `없음` 이면 시안 없이 `DESIGN.md` 기준으로 만들고 보고서에 "Pencil 미대조"로 표시한다. 탭 4개(홈·자산·예산·마이, 리포트 탭은 2026-09-23 제외)는 `DESIGN.md` §6 을 따른다. `(신규)` 라우트는 아직 파일이 없는 제안 경로다.

### 인증·온보딩 (순서대로 진행)

| 화면 ID | 화면명 | 라우트 | Pencil | P | 주요 API | 주요 기능 |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-01 | 로그인 | `app/(auth)/login.tsx` | budget 시안 톤 | P0 | `POST /auth/login` | 이메일·비밀번호. 실패 시 `AUTH_001` 인라인 문구(탈퇴 사유 노출 없음) |
| PAGE-02 | 회원가입 | `app/(auth)/signup.tsx` (신규) | 없음 | P0 | `POST /auth/signup` | 이메일·비밀번호·이름. 409 → "이미 사용 중인 이메일" |
| PAGE-03 | 약관 동의 | `app/(auth)/terms.tsx` | F7eWgz | P0 | 없음(로컬) | |
| PAGE-03B | 금융망 이메일 연결 | `app/(app)/onboarding/finance-email.tsx` (신규) | `finance-email` (mDdag) | P0 | `GET /links/status`(표시 여부 판정), 연결 API(URL 미확인) | SSAFY 금융망 가입 이메일 1개 입력 → 서버가 금융망 회원을 조회해 연결. **KeyFin 가입 이메일과 다를 수 있다.** 이 연결이 끝나야 PAGE-04 의 후보 목록이 나온다. 페이지 번호는 임시(팀 확정 필요) |
| PAGE-04 | 계좌·카드 연결 | `app/(app)/onboarding/asset-select.tsx` | xEhNa | P0 | `GET /links/candidates`, `POST /links` | 후보 목록 체크 → 연결. `linked=true` 항목은 선택 불가로 표시 |
| PAGE-05 | 수입 계좌 지정 | `app/(app)/onboarding/income-account.tsx` | 없음 | P0 | `GET /accounts`, `PUT /accounts/{id}/income` | 라디오 1개 선택. 이미 수입 계좌가 있으면 골라 둔 채로 연다 |
| PAGE-06 | 소비 분석 결과 | `app/(app)/onboarding/spending-analysis.tsx`(분석 중) · `spending-summary.tsx`(A) · `spending-envelopes.tsx`(B) | spending-analysis/analyzing (pWPd0) · /summary (mhzUD) · /envelopes (t02uSx) · /error (wcbvZ) | P0 | `POST /budgets/proposals` | 흐름(2026-09-11 BUDGET 백엔드와 합의): 수입 계좌 → 분석 중 → 요약(A) → 봉투별(B) → 예산 제안(PAGE-07). 옛 시안 oL0th 는 KeyFin 과 안 맞아 폐기 |
| PAGE-07 | 예산 제안·승인 | `app/(app)/onboarding/budget-proposal.tsx` (신규) | 없음 | P0 | `PUT /budgets/{month}/confirm` | 봉투 7종 슬라이더/입력, 근거(월평균) 표시, [이 예산으로 시작] |
| PAGE-08 | 캐릭터 입주중 | `app/(app)/character/moving-in.tsx` | PGyNo | P0 | `GET /room` 프리페치 | 로딩 연출 후 홈(`/?from=moving-in`). 방 그림(스프라이트)은 여기서 미리 읽을 수 없어, 홈이 같은 화면(`RoomWaiting`)을 덮어 **방을 다 그릴 때까지 입주 문구를 이어서** 보여 준다(2026-09-21) |

### 탭

| 화면 ID | 화면명 | 라우트 | Pencil | P | 주요 API | 주요 기능 |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-10 | 홈(방) | `app/(app)/(tabs)/index.tsx` | hcONw · zq2Xl · P0 시안 EWfx2 / XVFf1(예산 미설정) / KQLga(보드 활성화) / m2OQ5(캘린더 활성화) | P0 | `GET /room`, `POST /fin-coins/attendance`, `GET /transactions/pending`, `GET /budgets/current`, `GET /payments/calendar` | 방 씬(아바타·가구·벽 리스트·캘린더 스프라이트·코치 말풍선)이 화면 폭 가득, 코인 배지, 알림 버튼, 출석 토스트, 우상단 '꾸미기'(→ /room/edit). 홈 본문에 예산 카드는 없고(2026-09-15 사용자 결정) 벽 리스트 탭 → 예산 시트(예산 카드·봉투별 잔액·예산 탭 링크), 캘린더 탭 → 팝오버. P0 시안 확정(2026-09-08), 2026-09-15 방 확대·시트로 갱신. 캐릭터는 바닥을 걸어 다니다 가끔 소파에 앉아 쉰다(2026-09-21 되켬 — 2026-09-09 에 껐던 이유가 편집 방해였으므로 편집 중에만 끈다). 앉은 그림은 의상 세트에만 있어 기본 차림은 걷기만 한다 |
| PAGE-11 | 자산 | `app/(app)/(tabs)/assets.tsx` + 전체보기 `app/(app)/transaction/index.tsx` | g5w2Ll(P0 화면, 2026-09-15 코드 기준) · 킷 원본 UjYhB 참고만 | P0 | `GET /accounts`(계좌·총 자산), `GET /links/candidates`(카드 이름·번호 — 카드 목록 API 없음) + `GET /cards/billings`(카드 예상 청구액·출금 예정일, 둘 다 카드 탭에서만 호출), `GET /payments/calendar`, `GET /transactions` | 총 자산·계좌/카드 탭·정기결제 예정·최근 거래 3건 → 전체보기(월·봉투·계좌/카드 필터, 커서). 사용자 결정(2026-09-11): 대출 탭·송금 버튼 제거, 햄버거 비활성, 정기결제 '관리' 숨김 |
| PAGE-12 | 예산 | `app/(app)/(tabs)/budget.tsx` | K8MODs | P0(잔액) / P1(비상금) | `GET /budgets/current`, `PUT /budgets/{budgetId}/emergency` | 전체·봉투별 잔액, 기간(periodFrom~periodTo) 표시. 확정 전(PROPOSED)이면 예산 확정 화면으로 강제 이동(2026-09-12). 봉투 목록 아래 비상금 구역(FR-BGT-09, 2026-09-20) |
| PAGE-13 | 리포트 (제외) | — (2026-09-23 라우트 삭제) | r3Nmq | 제외 | `GET /reports/{month}` | 구현하지 않기로 결정(사용자 결정 2026-09-23) |
| PAGE-14 | 마이 | `app/(app)/(tabs)/my.tsx` | n374g | P0 | `GET /settings/transfer`, `POST /auth/logout` | 설정 진입, 연결 관리, 로그아웃 |

### 세부 화면 (탭·홈 요소에서 진입)

| 화면 ID | 화면명 | 라우트(제안) | Pencil | P | 주요 API | 주요 기능 |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-20 | 거래 분류 시트 | `features/transaction` 바텀시트 | 없음 | P0 | `GET /subcategories`, `PUT /transactions/{id}/classification` | 세분류 22종(봉투별 그룹) + 제외 태그 3종. `subcategoryId` 와 `excludeTag` 중 하나만 |
| PAGE-21 | 거래 상세 | `app/(app)/transaction/[id].tsx` | 없음 | P0 | 목록 캐시 + PAGE-20 | 분류·태그 수정 진입점 |
| PAGE-22 | 미확정 정리 | `app/(app)/transaction/pending.tsx` | 없음 | P0 목록 / P1 세션 | `GET /transactions/pending`, `PUT /transactions/{id}/classification`, `PUT /transactions/classifications` | 저녁 21:00 푸시(`CLEANUP`) 진입점. 건별 확정 + 하단 '제안대로 N건 확정'(2026-09-20 구현) — 제안 세분류가 있는 건만, 받아 둔 쪽 안에서, 한 번에 100건까지. 확인 창에서 '한 건이라도 안 되면 아무것도 바뀌지 않는다'를 알린다. 저녁 세션 코인은 아직 |
| PAGE-23 | 봉투 상세 | `app/(app)/budget/[envelopeId].tsx` | 없음 | P0 | `GET /transactions?envelopeId=` | 거래 목록·잔액 |
| PAGE-24 | 결제 캘린더 | `app/(app)/payment/calendar.tsx` | LGaxv · XGcYs(빈) · w5uuk(오류) · pfLbO(준비 상태 없음) | P0 | `GET /payments/calendar` | 날짜별 출금 예정, `prepared`/`shortage`(null 이면 생략)/`estimated` 뱃지, 유형 아이콘. 고정지출 항목은 모두 탭 → PAGE-26(직접 등록은 수정, 카드 정기결제는 읽기 전용 상세), 헤더 '관리' → PAGE-26B, 빈 달은 고정지출 등록 진입 |
| PAGE-25 | 이체 승인 | `app/(app)/payment/transfer/[id].tsx` | 없음 | P0 | `GET /transfers`, `approve`, `postpone` | "내일 월세 55만 원 출금 — 23만 원 미리 옮길까요?" [이체하기] [나중에]. 결과·실패 사유 표시 |
| PAGE-26 | 고정지출 등록·수정 | `app/(app)/payment/fixed-expense/[id].tsx` (`new` 포함) | LpGnf(등록) · v5HKz(수정) · fmksb(못 찾음) · kwEMQ(카드 정기결제 읽기 전용) | P0 | `GET /fixed-expenses`(수정 폼 초기값), `POST/PUT/DELETE /fixed-expenses` | 이름(50자)·유형 4종(CARD_BILL 제외)·금액(공과금은 예상 금액)·출금일(1~31, 말일 보정 전 값)·출금 계좌. 동기화 항목은 폼 대신 읽기 전용 상세(금액·유형·출금일·결제 경로 + 잠김 안내 띠) |
| PAGE-26B | 고정지출 관리 | `app/(app)/payment/fixed-expense/index.tsx` | mtr9c · riWW2(빈) · dETNH(오류) | P0 | `GET /fixed-expenses` | 직접 등록·카드 정기결제(`synced`) 두 섹션(제목 h2 검정), 모든 항목 탭 → PAGE-26(동기화는 읽기 전용), + 등록. 진입은 PAGE-24 헤더 '관리'. 명세 행 '고정지출 관리 화면용'에 따라 추가(사용자 결정 2026-09-15) |
| PAGE-27 | 설정 상세 | `app/(app)/my/settings.tsx` | 없음 | P0(이체) / P1(코치·알림) | `GET/PUT /settings/transfer`, `GET·PUT /settings/notifications`, `GET·PUT /settings/coach` | 이체 동의 토글·1회/1일 한도, 코치 말투, 알림 on/off·방해 금지 |
| PAGE-28 | 알림함 | `app/(app)/notification/index.tsx` | XZ84O · GRUCR(빈) · C10zu(로딩) · G8onl0(오류) | P1 | `GET /notifications`, `PATCH /notifications/{id}/read` | 서버 순서(최신순)로 날짜 묶음(오늘·어제·월일), 커서 무한 스크롤. 탭 → 읽음(낙관적) + `notiType`·`refId` 대상 화면(§3 표, refId 없거나 형식 오류면 목록 화면). **`requiresAction` 건 상단은 하지 않음**: 서버가 id 순 커서만 주고 requiresAction 을 풀지 않아 처리한 옛 알림이 계속 위에 남기 때문 — 안 읽은 건에만 "확인 필요" 뱃지. 진입: 홈 헤더 알림 버튼 |
| PAGE-29 | 상점 | `app/(app)/shop/index.tsx` | 없음 | P1 | `GET /shop`, `POST /shop/purchase` | 종류 선택창(거래 내역 필터와 같은 `FilterSelect` — 옷 구역은 '세트' 한 줄, 가구 구역은 '가구 전체'+분류(침대·소파·테이블·책상·의자·수납·가전), 꾸미기 구역은 벽 장식·소품·러그·식물 — 분류는 assetKey 로 방 카탈로그에서 찾고 파는 상품이 있는 분류만 보인다(2026-09-21 사용자 요청 '가구 카테고리', 벽·바닥 두 줄에서 바꿈), 기본값 '세트'. 모르는 부위 상품이 오면 '기타' 추가. 2026-09-20 사용자 결정으로 부위 칩 8개에서 선택창으로 바꿨고, 2026-09-21 옷이 세트가 되면서 부위 6줄을 한 줄로 합침), 상품 그림은 의상 세트(옷 그림)·방 카탈로그(가구 상점용 축소 그림, 2026-09-21 새 가구 — 백엔드 V20 의 판매 56종 + 기본 가구용 오리지널 3종) 이고 없으면 아이콘, `owned` 는 '보유 중'이고 누르면 쓰는 곳(옷장·방 꾸미기)으로 간다, 헤더에 코인 잔액. 구매는 확인 창 → `POST /shop/purchase`, 응답 잔액을 바로 캐시에 넣고 상품·코인·방 데이터를 무효화한다. **자동 장착·배치는 하지 않고 상점에서 입히지도 않는다** — 입고 놓는 곳은 옷장·방 꾸미기 한 곳뿐이고 상점은 거기로 데려다 주기만 한다(사용자 결정 2026-09-21: 장착 지점이 갈라지면 방금 산 것과 예전에 산 것을 다른 자리에서 다루게 된다). 산 직후 '샀어요' 창 → [옷장 열기]/[방 꾸미기 열기], 보유 중인 상품 카드도 누르면 같은 곳으로 간다. 진입: 홈 상점 버튼 (2026-09-20 구현) |
| PAGE-30 | 코인 이력 | `app/(app)/coin/index.tsx` | f7YQj · e1UFei(빈) · PK3Xv(로딩) · Gi7XY(오류) | P1 | `GET /fin-coins/balance`, `GET /fin-coins` | 잔액 카드 + 지급일(grantDate) 묶음 이력(사유 reasonText · 잔액 · ±증감, 커서). 진입: 홈 코인 배지. 출석으로 코인이 지급되면 잔액·이력 캐시 무효화. 코드 도메인은 `features/shop`(AGENTS: 상점·코인) (2026-09-17 구현) |
| PAGE-31 | 코칭 대화 | `app/(app)/coaching/chat.tsx` | 없음 | P1 | `GET·POST /coaching/chat`, `GET /transactions/pending` | 질문 → 답변 1턴. 서버가 사용자당 세션 하나를 24시간·20회까지 이어 주고 GET 으로 그 이력을 준다(2026-09-22 배포 확인·같은 날 구현). 홈의 코치 고양이 탭으로 진입. 이력 말풍선 + 하단 입력(2000자) + 보내기, 답 기다리는 동안 '생각하고 있어요', 실패는 그 자리에서 다시 시도. 상단에 '미확정 결제 n건 정리' 링크(홈 코치 말풍선에서 옮김)와 세션 만료 시각. Pencil 미대조 |
| PAGE-31B | 예산 예측 차트 | `app/(app)/coaching/chart/[chartId].tsx` | 없음 | P1 | `GET /coaching/charts/{chartId}/html` — **TBD**(2026-09-22 팀 결정은 'AI 차트를 HTML 로 받는다'까지, 중계 경로·답변의 chartId 필드는 백엔드 미확정) | 백엔드가 중계한 AI 서버의 자기완결 차트 HTML(카테고리 사용률·누적 소비·일별 막대·표, 약 50KB)을 화면 가득 WebView 로 그린다(웹은 srcdoc iframe). 말풍선 안에 넣지 않는다 — 목록 안에서 높이를 못 잡고 차트 터치가 스크롤과 겹친다. 못 찾음(id 모양 아님·404) → '대화로 돌아가기', 실패 → 다시 시도. 진입: PAGE-31 코치 답변 아래 '예산 예측 차트 보기' 버튼(답변·이력의 `chartId` — 앱 제안 필드, 목은 COACHING 답변에 붙임). WebView 세팅·화면·목·진입 2026-09-22 구현. Pencil 미대조 |
| PAGE-32 | 연결 관리 | `app/(app)/my/links.tsx` | 없음 | P1 | `GET /links/candidates`, `POST /links`, `DELETE /links/...` | |
| PAGE-33 | 카드 청구 상세 | `app/(app)/payment/card-billing/[id].tsx` | LsAZT · AcQNS(내역 없음·출금일 모름) · H5Wkz(로딩) · yf3NJ(오류) · u8EwPt(못 찾음) | P1 | `GET /cards/{id}/billings`, `GET /links/candidates`(발급사·번호, 실패해도 화면은 연다) | 이번 주 예정액·기간·확정 안내 띠, 승인 내역(최신순), 발행 청구서(미결제·결제 완료 뱃지). 진입: 자산 탭 카드 행 · 결제 캘린더 CARD_BILL 항목. 404 PAY_013·잘못된 id → 못 찾음 → 자산 탭 |

### 정리 대상 (KeyFin 명세에 없음 — 사용자 결정 TBD)

| 라우트 | 상태 | 제안 |
| --- | --- | --- |
| `app/(app)/character/register.tsx` | 홈 "캐릭터를 등록하세요" CTA 목적지 | **결정(2026-09-08)**: 삭제하지 않고 PAGE-08 입주 연출로 재활용한다. 백엔드가 가입 시 기본 착장을 자동 지급하므로 홈의 "캐릭터 없음" 상태와 등록 CTA 는 제거한다 |
| `app/account/[accountId].tsx` | 계좌 상세 | 명세에 계좌 상세 화면 없음. PAGE-11 의 계좌 필터로 흡수 |
| `app/transfer/recipient·amount·confirm·complete.tsx` | 일반 송금 플로우 | KeyFin 이체는 승인 기반 결제 준비 이체(PAGE-25)뿐이다. 삭제 또는 PAGE-25 로 재활용 |
| `features/home/api/home.api.ts` 의 `GET /home/summary` | Pencil 에서 역산한 임시 계약 | 명세에 없는 경로. `GET /room` + `GET /budgets/{month}` 로 교체 |

## 3. 이동 흐름

```
[온보딩]  PAGE-01 로그인 ─(계정 없음)─ PAGE-02 회원가입 ─ PAGE-03 약관 ─ PAGE-04 계좌·카드 연결
          ─ PAGE-05 수입 계좌 ─ PAGE-06 소비 분석 ─ PAGE-07 예산 제안·승인 ─ PAGE-08 입주중 ─ PAGE-10 홈
[결제 후]  푸시/말풍선(분류 질문) ─ PAGE-10 [외식 확정] 또는 PAGE-20 시트 ─ 보드 잔액 즉시 갱신(응답의 envelopeBalance)
[결제 준비] 07:00 푸시 TRANSFER_REQUEST(refId) ─ PAGE-25 이체 승인 ─ [이체하기]→EXECUTED / [나중에]→PROPOSED 유지 ─ PAGE-24 캘린더 반영
[고정지출]  PAGE-24 결제 캘린더 ─ 항목 탭 ─ (직접 등록) PAGE-26 수정·삭제 / (카드 정기결제 synced) PAGE-26 읽기 전용 상세
           PAGE-24 헤더 '관리' ─ PAGE-26B 고정지출 관리 ─ 항목 탭 → PAGE-26 · [+] 또는 빈 상태 '고정지출 등록' → PAGE-26 등록
           자산 탭(PAGE-11) 정기결제 예정 '관리' → PAGE-24. 준비 상태(prepared·shortage)는 FR-PAY-02 전까지 null 이라 뱃지를 그리지 않는다 (2026-09-15)
[방 꾸미기] PAGE-10 홈 방 씬 우상단 '꾸미기' → /room/edit(PAGE-10 방 꾸미기) ─ 가구는 바닥 격자, 벽 보드·캘린더·벽 장식은 벽 격자에서 드래그 ─ 보관함(GET /furnitures 중 방에 없는 보유 가구)을 누르면 빈 칸에 놓인다 ─ 고른 가구의 [방향 바꾸기](방향별 그림 2장을 바꿔 끼우고 placementDirection 으로 저장, 벽 장식은 맞은편 벽으로) · [넣어 두기](보관함으로, 기본 가구·보드·캘린더는 불가) (2026-09-21 사용자 결정) ─ [완료] 바뀐 가구마다(넣어 둔 것은 placed:false) `PATCH /furnitures/{userFurnitureId}` 로 저장한 뒤 확정 / [취소·뒤로] 버림 → 홈. 저장 실패는 사본을 둔 채 다시 시도(멱등). 배치의 원천은 `GET /room` 의 furnitures 이고, 아이템 시드 전이라 빈 응답이면 기본 배치를 그대로 그린다 (3단계, 2026-09-16). 벽 오브젝트 위치는 팝오버·오버레이가 따라간다 (2026-09-15)
           화면 배치(2026-09-21 사용자 결정): 방을 최대한 크게 쓴다 — 취소/완료는 헤더로(뒤로 = 취소, 오른쪽 '완료'), 고른 가구의 '방향 바꾸기'·'넣어 두기'는 그 가구 옆 말풍선, 보관함은 하단 손잡이 한 줄로 접어 두고 누르면 시트로 올라온다(가구를 꺼내면 다시 내려간다). 상점에서 가구를 사고 넘어오면(/room/edit?from=shop) 보관함을 펴 둔 채로 연다. 방은 contain 맞춤이라 잘리는 바닥이 없다. Pencil HTF8Q 와 배치가 달라졌다(미대조)
[홈 요소]  벽 보드 탭 → PAGE-12 / 봉투 바 탭 → PAGE-23 · 캘린더 탭 → 팝오버 '캘린더 열기' → PAGE-24 · 코치 탭 → PAGE-31(P1) · 코인 배지 → PAGE-30(P1) · 상점 버튼 → PAGE-29(P1)
```

**푸시 딥링크 매핑** (`notiType` → 화면). 알림함 type 기준이다. FCM `data.type` 은 Notion 규약 9종이 따로 있다(미결 3번, api-contract NOTIFICATION).

| notiType | 진입 화면 | refId |
| --- | --- | --- |
| `COACHING` | **PAGE-22 미확정 정리 — 그 거래의 분류 창을 바로 연다**(`/transaction/pending?focus=<거래 id>`, 2026-09-21). refId 가 없으면 PAGE-10 홈 | **거래 id** — 서버의 COACHING 은 "새로 정리할 거래가 있어요"다(TransactionNotificationService, develop 392ca77). 거래 상세로 바로 보내지 않는 이유: 단건 조회 API 가 없어 캐시에 없는 거래는 못 연다. 끝까지 찾아도 없으면 "이미 정리했어요"로 알린다 |
| `BUDGET_ALERT` | PAGE-12 예산 또는 PAGE-23 봉투 상세 | envelopeId |
| `TRANSFER_REQUEST` | PAGE-25 이체 승인 | transferId — ★ 서버가 **'승인 필요' 알림에만 받는 계좌 id** 를 넣는다(TransferProposed 이벤트에 이체 id 가 없음). 완료·실패 알림은 이체 id 가 맞다. 백엔드 수정 요청 대상(api-contract NOTIFICATION) |
| `CLEANUP` | PAGE-22 미확정 정리 | 없음 |
| `WARNING` | PAGE-24 캘린더 | 계좌 id(ShortageWarningService) — 쓰지 않는다 |

**서버가 실제로 보내는 푸시 data(NotificationPushListener, develop 392ca77, 2026-09-21 대조)는 `{ notificationId, type, requiresAction, refId? }` 이고 `type` 은 위 알림함 5종과 같다** — 아래 Notion 9종·종류별 id 필드는 아직 구현되지 않았다. 앱은 둘 다 읽는다(종류별 필드 먼저, 없으면 `refId`). 단 `TRANSFER_REQUEST` 는 위 ★ 때문에 `refId` 를 이체 id 로 믿지 않는다.

FCM `data.type` (푸시 탭, `features/notification/model.ts` 의 `pushNotificationHref`). 9종 규약은 `docs/api-contract.md` NOTIFICATION 에 있다. id 가 없거나 양수 id 모양이 아니면 목록 화면으로 보낸다.

| data.type | 진입 화면 | 쓰는 data 필드 |
| --- | --- | --- |
| `TRANSFER_REQUEST` | PAGE-25 이체 승인 (없으면 PAGE-24) | transferId |
| `BUDGET_ALERT` | PAGE-23 봉투 상세 (없으면 PAGE-12) | envelopeId |
| `CLASSIFY_QUESTION` | PAGE-22 미확정 정리에서 그 거래의 분류 창(없으면 PAGE-22 목록) — 2026-09-21 에 'PAGE-21 거래 상세'에서 바꿈(단건 조회 API 가 없다) | transactionId |
| `CLEANUP` | PAGE-22 미확정 정리 | 없음 |
| `PAYMENT_RISK` | PAGE-24 캘린더 — 알림함 `WARNING` 과 도착지를 맞춘다(2026-09-20 결정, fixedExpenseId 는 쓰지 않음) | 없음 |
| `NEW_LINK_FOUND` | PAGE-32 연결 관리 — 2026-09-20 결정 | 없음 |
| `COIN_GRANTED` | PAGE-30 코인 이력 — 2026-09-20 결정 | 없음 |
| `COACHING` | refId(거래 id)가 있으면 PAGE-22 분류 창, 없으면 PAGE-10 홈 | refId |
| `WARNING` | PAGE-24 캘린더 — **지금 서버가 실제로 보내는 미납 경고**(Notion 규약의 PAYMENT_RISK 자리) | 없음 |
| `REACTION` | PAGE-10 홈 — 2026-09-20 결정 | 없음 |
| 모르는 값 | 이동 없음(앱만 열린다) | — |

## 4. 화면 공통 상태 규칙

`AGENTS.md` 완료 기준(로딩·빈·오류·비활성·중복 실행 방지)을 KeyFin 화면에 적용한 규칙이다. 화면마다 아래를 모두 구현해야 완성으로 본다.

| 상황 | 규칙 |
| --- | --- |
| 로딩 | `Skeleton`. **홈은 예외** — 방 데이터와 방 그림을 다 읽을 때까지 입주 화면과 같은 대기 화면(`RoomWaiting`)을 덮는다. 입주 직후엔 입주 문구, 이미 입주한 계정은 "캐릭터가 샤워하고 있어요" 등 4종 중 하나(사용자 요청 2026-09-21). 첫 진입 안내·출석 토스트는 덮개가 걷힌 뒤 시작하고, 그림이 끝내 안 읽혀도 10초 뒤에는 걷는다. 오류면 바로 걷어 다시 시도를 보여 준다. 방 꾸미기 등 다른 화면의 방 씬은 바닥·가구를 먼저 그리고 서버 데이터(보드·아바타 착장)만 스켈레톤. 의상 세트 그림은 방이 뜬 뒤에 따로 읽어 진입을 막지 않는다(2026-09-21) |
| 빈 상태 | 화면별 문구를 고정한다: 계좌 후보 0건 "연결할 계좌가 없어요", 거래 0건 "이번 달 거래가 아직 없어요", 미확정 0건 "정리할 결제가 없어요", 이체 제안 0건 "준비할 결제가 없어요", 알림 0건 "알림이 없어요" |
| 예산 미승인 월 | `GET /budgets/{month}` 의 `status=PROPOSED`(total·잔액 `null`) → 보드는 "예산 미설정" + 승인 유도 배너, 봉투 바는 비활성 |
| 오류 | `ApiError.code` 로 분기해 `features/<domain>/errors.ts` 의 문구를 쓰고, 없으면 서버 `message`(백엔드가 사용자 문구로 변환해 준다) → 재시도 버튼. 401 은 토큰 갱신 후 1회 재시도, 실패 시 로그인 |
| 중복 실행 | 이체 승인·구매·출석·분류 확정은 `isPending` 동안 버튼 비활성 + 같은 요청 단일 실행. 승인·재시도의 멱등성은 서버(기관거래고유번호)가 보장하지만 클라이언트도 이중 탭을 막는다 |
| 오프라인·타임아웃 | 조회 10초, 이체·구매 30초(`api/client.ts` 상수). 타임아웃은 재시도 가능한 폴백 |

## 5. 프론트가 지켜야 할 비즈니스 규칙

- **봉투 7종은 고정 id** 1 외식 · 2 교통비 · 3 의료·건강 · 4 취미·여가 · 5 쇼핑 · 6 편의점·마트·잡화 · 7 기타. 세분류 22종의 id 는 `봉투 id × 100 + n`(외식 101~104, 교통 201~203 …). 목록은 `GET /subcategories` 로 받되 봉투 순서·색은 클라이언트 상수로 둔다.
- **금액은 원 단위 정수**이며 JSON number(Long) 로 온다. 화면 표시는 `lib/money.ts` 의 `formatKRW` 만 사용한다.
- **잔액·잔여율·부족액은 서버 값만 표시**한다(`remaining`, `remainingRate`, `shortage`). 클라이언트에서 뺄셈·비율 계산을 하지 않는다. 현재 `features/home/model.ts` 의 70% 경고 임계값은 임시이며 서버 `remainingRate` 와 알림 구간(50/30/10/5/0)으로 교체한다(TBD).
- **분류 확정**: 요청은 `subcategoryId` 와 `excludeTag` 중 하나만. 응답의 `envelopeBalance` 로 보드를 즉시 갱신하고 관련 쿼리는 무효화한다. 같은 거래에 질문은 1회, 30초 무응답 시 말풍선 축소(거래는 PENDING 유지).
- **거래 목록**은 `CANCELED`·제외 태그(`DUTCH`/`SELF_TRANSFER`/`EMERGENCY`/`CARRYOVER`) 거래를 숨기지 않고 뱃지로 구분한다(봉투 합계와 목록 합계 불일치 방지).
- **이체 승인**은 `transferConsent=false` 이면 진입 자체를 막고 설정으로 유도한다. 결과 `EXECUTED`/`FAILED` 와 `failReason` 을 그대로 보여준다.
- **출석**은 홈 진입 시 1회 호출, `granted=0` 이면 UI 반응 없이 `balance` 만 갱신한다.
- **아바타·가구 렌더링**은 `GET /room` 의 `avatar.equipped[].assetKey` 로 로컬 에셋을 찾는다. `assetKey` 가 로컬에 없으면 기본 착장으로 폴백하고 보고한다. `reaction.type` 의 값 목록은 미확정(TBD) — 모르는 값은 기본 모션.
- **코치 말투** `DODO`/`ONSOON`(기본)/`JIBANG` 은 서버 설정값이며 프론트는 문구를 만들지 않는다.
- **홈의 벽 보드·캘린더는 방 에셋이 진입점**이다(결정 2026-09-08). 평소에는 에셋 위에 잔여율·다음 출금일 같은 최소 정보만 보이고, 탭하면 팝오버가 열린다. 팝오버 안의 링크가 예산 탭·결제 캘린더로 이어진다. 예산 카드의 봉투 7종은 사용률(`spent ÷ confirmed`, 초과는 100% 캡) 세로 막대로 그린다.

## 6. 미결·TBD (프론트에 영향 있는 것만)

| # | 항목 | 출처 | 프론트 대응 |
| --- | --- | --- | --- |
| 1 | **방 가구 배치 API 없음** — 팀 API 명세의 GAME 도메인은 `PUT /items/{userItemId}/equip` 과 `user_items.slot`(문자열 자리, 임시값 `SOFA`/`TABLE`/`DECO`) 뿐이다. 개인 노션의 `PUT /room/layout`(x·y 좌표 통째 저장)은 팀 명세에 없다 | API 명세서 · ERD 18 · 미결 #12 | `features/room` 의 드래그 배치(씬 좌표)를 유지하려면 백엔드에 `PUT /room/layout` 추가를 요청하거나, 슬롯 기반 배치로 바꿔야 한다. 결정 전까지 배치는 클라이언트 상태(Zustand)에만 둔다 |
| 2 | `reaction.type`·`assetKey`·`themeCode` 값 목록, 아트 스타일(3D풍 vs 2D) | API 명세서 · 미결 #12 | 백엔드 확정 후 `features/room/catalog.ts` 에 매핑 |
| 3 | FCM `data.type` 값과 딥링크 파라미터 — **Notion 「FCM 토큰 등록·갱신」 행에 data 규약 9종이 있다(2026-09-17 확인)**, 발송 코드는 아직 없어 코드 대조 불가 | API 명세서(FCM 토큰) · api-contract NOTIFICATION | 포그라운드 표시·탭 딥링크 모두 규약 9종 기준으로 구현했다(2026-09-20). 푸시 전용 4종과 PAYMENT_RISK 의 진입 화면은 §3 표에 기록(사용자 결정). **남은 미결은 값 자체의 확인**이다 — 발송 코드가 생기면 data.type 문자열과 id 필드명을 실제 메시지로 대조해야 한다 |
| 4 | 에러 `code` 카탈로그 — AUTH·USER·COMMON 접두 코드는 2026-09-10 확인, 다른 도메인 코드는 미확인 | API 명세서 | `errors.ts` 는 확인된 코드만 넣고 나머지는 서버 `message` 폴백 |
| 5 | Pencil 시안 없는 화면(PAGE-01·02·05·07·20~32) | design-map.json | 시안이 생기면 `design-map.json` 에 노드 id 를 넣고 대조 |
| 6 | 예산 초과 패널티, 월 코인 공식, 커스터마이징 충돌 규칙, 코치 말투 가이드, 카드 할부 재현, 질문 빈도, 상점 밸런싱 | 요구사항 미결 #1~#8 · 미결 사항 정리 C | P1 이후. 화면을 미리 만들지 않는다 |
| 7 | `app/account/[accountId].tsx`, `app/transfer/*`, `GET /home/summary` 처리 | §2 정리 대상 | 사용자 결정 대기. `character/register` 는 입주 연출 재활용으로 결정됨 |
| 8 | ~~아바타 착장(슬롯 레이어)~~ **해결(2026-09-21)** · 카테고리 반응 연출은 미결 | FR-GAM-02, `avatar.equipped`·`reaction` | 슬롯 레이어는 하지 않는다 — 옷이 세트 한 벌이라 `equipped` 의 assetKey 로 세트를 찾아(`features/room/outfits.ts`) 캐릭터 그림을 통째로 바꾼다. 카탈로그에 없는 assetKey 면 기본 캐릭터로 폴백하고, 세트 그림은 방 진입을 막지 않도록 방이 뜬 뒤에 따로 읽는다. **카테고리 반응은 `reaction.type` 값 목록이 아직 미확정이라 그대로 미결**(#2) |
| 9 | **거래 분류 흐름과 백엔드(2026-09-15 develop 대조)** — 서버는 PENDING 거래에 제안 세분류를 주지 않고, DUTCH 는 실제 부담액 필수, EMERGENCY 는 비상금 연동 전까지 불가(노션). `GET /subcategories`·`GET /transactions/{id}` 없음 | api-contract TRANSACTION ★ | **결정(2026-09-15)**: 코치 말풍선은 코치봇 소통창 전까지 임시 "?" + 미확정 정리 링크만(분류는 PAGE-22·PAGE-21 에서), 더치페이는 세분류 시트 안 금액 입력 단계, 비상금 칩은 제거. 세분류 목록 API·단건 조회는 백엔드 요청 |
| 10 | ~~결제 캘린더 CARD_BILL 항목의 탭 대상~~ **해결(2026-09-17)** — P1 카드 청구 상세(PAGE-33)가 생겨 `cardId` 로 연결했다 | api-contract PAYMENT | `canOpenCardBilling` → `/payment/card-billing/{cardId}`. `cardId` 가 null 인 항목만 정보 항목으로 남는다 |
