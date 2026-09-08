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
| FR-USR-01 | 회원가입·로그인 | P0 | 화면 | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh` | 가입 시 백엔드가 기본 헤어·옷·표정 3종을 지급·장착. 탈퇴 계정 이메일 재가입 불가 |
| FR-USR-02 | 계좌·카드 연결(opt-in) | P0 | 화면 | `GET /links/candidates`, `POST /links` | 이미 연결된 항목 재선택은 무시(멱등). 후보 0건이면 "연결할 계좌가 없어요" + 시연 셋업 안내 |
| FR-USR-03 | 수입 계좌 지정 | P0 | 화면 | `GET /accounts`, `PUT /accounts/{id}/income` | 사용자당 1개, 기존 것은 자동 해제 |
| FR-USR-04 | 온보딩 소비 분석 | P0 | 화면 | `POST /budgets/proposals` | 연결 직후 10초 내 "지난 소비를 분석했어요" → 예산 제안 화면 |
| FR-USR-05 | 연결 관리(추가·해제) | P1 | 화면 | `DELETE /links/accounts/{id}`, `DELETE /links/cards/{id}` | |
| FR-USR-06 | 계정 관리 | P1 | 화면 | `POST /auth/logout`, `PUT /auth/password`, `DELETE /users/me` | |
| FR-USR-07 | 설정(코치 말투·이체 동의·한도) | P1 | 화면 | `GET/PUT /settings`, 코치 말투 `PUT`(URL 미확인) | 이체 동의·한도(FR-PAY-04 입력)는 P0 API |

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
| FR-BGT-02 | 예산 승인·조정 | P0 | 화면 | `PUT /budgets/{month}/confirm` | 봉투 7개 전부 전송. 승인 없이 월 시작 시 "예산 미설정" 상태 + 홈 승인 유도 배너 |
| FR-BGT-03 | 봉투 차감 | P0 | 없음 | — | 잔액은 서버 파생 계산. 클라에서 재계산 금지 |
| FR-BGT-04 | 잔여 예산 상시 표시 | P0 | 화면 | `GET /budgets/{month}`, `GET /room` | 방 벽 보드: 전체 진행률 + 봉투 7종 바. 탭 → 봉투 상세 |
| FR-BGT-05 | 잔액 구간 알림 | P0 | 표시 | 푸시(`BUDGET_ALERT`) | 잔여율 50/30/10/5/0% 하향 통과 시 월 1회. 보드 깜빡임 연출 |
| FR-BGT-06 | 카드 청구 예정액 | P1 | 화면 | `GET /cards/{id}/billings` | |
| FR-BGT-07 | 월간 소비 리포트 | P1 | 화면 | `GET /reports/{month}` | 예산 확정 전 월은 404 |
| FR-BGT-08 | 다음 달 예산 조정 제안 | P1 | 화면 | `POST /budgets/proposals` (basis=전월 실적, `adjustment`) | |
| FR-BGT-09 | 비상금 설정 | P1 | 화면 | `PUT /budgets/{month}/emergency` | |
| FR-BGT-10 | 절감 포인트 안내 | P2 | 화면 | `GET /savings/insights` | |

### PAY — 정기 지출·결제 준비

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-PAY-01 | 정기 지출 통합 일정 | P0 | 화면 | `GET /payments/calendar` | 방 캘린더: 날짜별 출금 예정(이름·금액·준비 상태 뱃지) |
| FR-PAY-02 | 필요 금액 계산 | P0 | 표시 | (캘린더 응답의 `prepared`·`shortage`·`estimated`) | 매일 06:00 배치 |
| FR-PAY-03 | 승인 기반 자동 이체 | P0 | 화면 | `GET /transfers`, `POST /transfers/{id}/approve`, `POST /transfers/{id}/postpone` | 07:00 제안 푸시(`TRANSFER_REQUEST`, `refId`=이체 ID) → 승인 화면 직행 |
| FR-PAY-04 | 이체 안전장치 | P0 | 화면·표시 | `GET/PUT /settings` | 동의 OFF 면 이체 실행 경로 자체를 노출하지 않는다. 검사 실패 사유는 알림·`failReason` 으로 |
| FR-PAY-05 | 미납·연체 위험 알림 | P1 | 표시 | 푸시(`WARNING`) | |
| FR-PAY-06 | 이체 실패 처리 | P1 | 화면 | `POST /transfers/{id}/retry` | |
| FR-PAY-07 | 고정지출 수동 등록·수정·삭제 | P0 | 화면 | `POST/PUT/DELETE /fixed-expenses` | 출금일 29~31 + 없는 달은 말일 보정(서버) |
| FR-PAY-08 | 이체 이력 조회 | P1 | 화면 | `GET /transfers?status=EXECUTED` | |
| FR-PAY-09 | 공과금 관리 | P2 | 화면 | `POST /fixed-expenses` (`expenseType=UTILITY`, `isVariable=true`) | |

### GAM — 방·캐릭터·코인

| ID | 기능명 | P | FE | API | 비고 |
| --- | --- | --- | --- | --- | --- |
| FR-GAM-01 | 방 홈 화면 | P0 | 화면 | `GET /room` | 가을 테마 1종 + 벽 보드·캘린더·아바타·코치. 요소 탭 = 기능 진입. 방 진입 1초 내 실제 데이터 렌더링 |
| FR-GAM-02 | 아바타 카테고리 반응 | P0 | 표시 | `GET /room` (`avatar.reaction`) | 봉투→반응 매핑(쇼핑=쇼핑백 등)은 소품 오버레이, 착장 유지. 결제 → 90초 내 반응 |
| FR-GAM-03 | 일 코인 지급 | P0 | 화면·표시 | `POST /attendance` | 당일 첫 진입 +10(중복이면 `granted=0`), 전건 확정 +30 은 자정 배치 |
| FR-GAM-04 | 주·월 코인 | P1 | 표시 | `GET /coins` | 주 200(예산 잔여), 월 최대 1,000(공식 미결) |
| FR-GAM-05 | 방·캐릭터 꾸미기 | P1 | 화면 | `GET /shop`, `POST /shop/purchase`, `PUT/DELETE /items/{userItemId}/equip` | 슬롯 유형: 방 WALLPAPER/FLOOR/FURNITURE, 캐릭터 HAIR/OUTFIT/FACE |
| FR-GAM-06 | 예산 초과 연출 | P1 | 화면 | `GET /room` (`stickers`, `overEnvelopes`), `POST /room/stickers/remove` | 전체 초과 시 압류 딱지 7개, 하루 1개 제거 |
| FR-GAM-07 | 방 테마 확장 | P2 | 화면 | `GET /themes`, `PUT /room/theme` | |
| FR-GAM-08 | 코인 잔액·이력 | P1 | 화면 | `GET /coins` | "왜 받았는지"(`reasonText`) 포함 |

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
| FR-NTF-01 | 푸시 알림 | **P0**(승격, 팀 결정 2026-09-07) | 화면 | `POST /devices` | 로그인 시 FCM 토큰 등록·갱신. 앱 미실행 상태에서 푸시 탭 → 해당 화면 직행(딥링크) |
| FR-NTF-02 | 알림함 | P1 | 화면 | `GET /notifications`, `PUT /notifications/{id}/read`, `PUT /notifications/read-all` | `requiresAction`+`refId` 로 미처리 건 바로 처리 |
| FR-NTF-03 | 알림 설정 | P1 | 화면 | `PUT /settings/notifications` | 유형별 on/off, 방해 금지 시간 |

## 2. 화면 목록

라우트는 Expo Router 경로. **Pencil** 열은 `design/design-map.json` 의 노드 id 이며 `없음` 이면 시안 없이 `DESIGN.md` 기준으로 만들고 보고서에 "Pencil 미대조"로 표시한다. 탭 5개(홈·자산·예산·리포트·마이)는 `DESIGN.md` §6 을 따른다. `(신규)` 라우트는 아직 파일이 없는 제안 경로다.

### 인증·온보딩 (순서대로 진행)

| 화면 ID | 화면명 | 라우트 | Pencil | P | 주요 API | 주요 기능 |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-01 | 로그인 | `app/(auth)/login.tsx` | 없음 | P0 | `POST /auth/login` | 이메일·비밀번호. 실패 시 `ERR_LOGIN_FAIL` 인라인 문구(탈퇴 사유 노출 없음) |
| PAGE-02 | 회원가입 | `app/(auth)/signup.tsx` (신규) | 없음 | P0 | `POST /auth/signup` | 이메일·비밀번호·이름. 409 → "이미 사용 중인 이메일" |
| PAGE-03 | 약관 동의 | `app/(auth)/terms.tsx` | F7eWgz | P0 | 없음(로컬) | |
| PAGE-04 | 계좌·카드 연결 | `app/onboarding/asset-select.tsx` | xEhNa | P0 | `GET /links/candidates`, `POST /links` | 후보 목록 체크 → 연결. `linked=true` 항목은 선택 불가로 표시 |
| PAGE-05 | 수입 계좌 지정 | `app/onboarding/income-account.tsx` (신규) | 없음 | P0 | `GET /accounts`, `PUT /accounts/{id}/income` | 라디오 1개 선택 |
| PAGE-06 | 소비 분석 결과 | `app/onboarding/asset-import-result.tsx` | oL0th | P0 | `POST /budgets/proposals` | "지난 소비를 분석했어요" → 제안 화면 |
| PAGE-07 | 예산 제안·승인 | `app/onboarding/budget-proposal.tsx` (신규) | 없음 | P0 | `PUT /budgets/{month}/confirm` | 봉투 7종 슬라이더/입력, 근거(월평균) 표시, [이 예산으로 시작] |
| PAGE-08 | 캐릭터 입주중 | `app/character/moving-in.tsx` | PGyNo | P0 | `GET /room` 프리페치 | 로딩 연출 후 홈 |

### 탭

| 화면 ID | 화면명 | 라우트 | Pencil | P | 주요 API | 주요 기능 |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-10 | 홈(방) | `app/(tabs)/index.tsx` | hcONw · zq2Xl | P0 | `GET /room`, `POST /attendance`, `GET /transactions/pending` | 방 씬(아바타·가구·보드·캘린더·코치), 코인 배지, 분류 질문 말풍선, 출석 |
| PAGE-11 | 자산 | `app/(tabs)/assets.tsx` | UjYhB | P0 | `GET /accounts`, `GET /transactions` | 연결 계좌·카드, 거래 내역 목록(필터·커서) |
| PAGE-12 | 예산 | `app/(tabs)/budget.tsx` | K8MODs | P0 | `GET /budgets/{month}` | 전체·봉투별 잔액, 미승인 월 배너 |
| PAGE-13 | 리포트 | `app/(tabs)/report.tsx` | r3Nmq | P1 | `GET /reports/{month}` | 월 선택, 초과·상위 세분류 |
| PAGE-14 | 마이 | `app/(tabs)/my.tsx` | n374g | P0 | `GET /settings`, `POST /auth/logout` | 설정 진입, 연결 관리, 로그아웃 |

### 세부 화면 (탭·홈 요소에서 진입)

| 화면 ID | 화면명 | 라우트(제안) | Pencil | P | 주요 API | 주요 기능 |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-20 | 거래 분류 시트 | `features/transaction` 바텀시트 | 없음 | P0 | `GET /subcategories`, `PUT /transactions/{id}/classification` | 세분류 22종(봉투별 그룹) + 제외 태그 3종. `subcategoryId` 와 `excludeTag` 중 하나만 |
| PAGE-21 | 거래 상세 | `app/transaction/[id].tsx` | 없음 | P0 | 목록 캐시 + PAGE-20 | 분류·태그 수정 진입점 |
| PAGE-22 | 미확정 정리 | `app/transaction/pending.tsx` | 없음 | P0 목록 / P1 세션 | `GET /transactions/pending`, `PUT /transactions/classifications` | 저녁 21:00 푸시(`CLEANUP`) 진입점 |
| PAGE-23 | 봉투 상세 | `app/budget/[envelopeId].tsx` | 없음 | P0 | `GET /transactions?envelopeId=` | 거래 목록·잔액 |
| PAGE-24 | 결제 캘린더 | `app/payment/calendar.tsx` | 없음 | P0 | `GET /payments/calendar` | 날짜별 출금 예정, `prepared`/`shortage`/`estimated` 뱃지, 고정지출 등록 진입 |
| PAGE-25 | 이체 승인 | `app/payment/transfer/[id].tsx` | 없음 | P0 | `GET /transfers`, `approve`, `postpone` | "내일 월세 55만 원 출금 — 23만 원 미리 옮길까요?" [이체하기] [나중에]. 결과·실패 사유 표시 |
| PAGE-26 | 고정지출 등록·수정 | `app/payment/fixed-expense/[id].tsx` (`new` 포함) | 없음 | P0 | `POST/PUT/DELETE /fixed-expenses` | 이름·유형·금액·출금일(1~31)·출금 계좌 |
| PAGE-27 | 설정 상세 | `app/my/settings.tsx` | 없음 | P0(이체) / P1(코치·알림) | `GET/PUT /settings`, `PUT /settings/notifications`, 코치 말투 | 이체 동의 토글·1회/1일 한도, 코치 말투, 알림 on/off·방해 금지 |
| PAGE-28 | 알림함 | `app/notification/index.tsx` | 없음 | P1 | `GET /notifications`, 읽음 처리 | `requiresAction` 건 상단, 탭 → `refId` 대상 화면 |
| PAGE-29 | 상점 | `app/shop/index.tsx` | 없음 | P1 | `GET /shop`, `POST /shop/purchase` | 슬롯 탭, `owned` 표시, 코인 잔액 |
| PAGE-30 | 코인 이력 | `app/coin/index.tsx` | 없음 | P1 | `GET /coins` | 잔액 + 사유별 이력(커서) |
| PAGE-31 | 코칭 대화 | `app/coaching/chat.tsx` | 없음 | P1 | `POST /coaching/chat` | 질문 → 답변 1턴 |
| PAGE-32 | 연결 관리 | `app/my/links.tsx` | 없음 | P1 | `GET /links/candidates`, `POST /links`, `DELETE /links/...` | |

### 정리 대상 (KeyFin 명세에 없음 — 사용자 결정 TBD)

| 라우트 | 상태 | 제안 |
| --- | --- | --- |
| `app/character/register.tsx` | 홈 "캐릭터를 등록하세요" CTA 목적지 | 백엔드는 가입 시 기본 착장을 자동 지급하므로 "캐릭터 없음" 상태가 명세에 없다. 삭제하거나 PAGE-08 입주 연출로 대체 |
| `app/account/[accountId].tsx` | 계좌 상세 | 명세에 계좌 상세 화면 없음. PAGE-11 의 계좌 필터로 흡수 |
| `app/transfer/recipient·amount·confirm·complete.tsx` | 일반 송금 플로우 | KeyFin 이체는 승인 기반 결제 준비 이체(PAGE-25)뿐이다. 삭제 또는 PAGE-25 로 재활용 |
| `features/home/api/home.api.ts` 의 `GET /home/summary` | Pencil 에서 역산한 임시 계약 | 명세에 없는 경로. `GET /room` + `GET /budgets/{month}` 로 교체 |

## 3. 이동 흐름

```
[온보딩]  PAGE-01 로그인 ─(계정 없음)─ PAGE-02 회원가입 ─ PAGE-03 약관 ─ PAGE-04 계좌·카드 연결
          ─ PAGE-05 수입 계좌 ─ PAGE-06 소비 분석 ─ PAGE-07 예산 제안·승인 ─ PAGE-08 입주중 ─ PAGE-10 홈
[결제 후]  푸시/말풍선(분류 질문) ─ PAGE-10 [외식 확정] 또는 PAGE-20 시트 ─ 보드 잔액 즉시 갱신(응답의 envelopeBalance)
[결제 준비] 07:00 푸시 TRANSFER_REQUEST(refId) ─ PAGE-25 이체 승인 ─ [이체하기]→EXECUTED / [나중에]→PROPOSED 유지 ─ PAGE-24 캘린더 반영
[홈 요소]  벽 보드 탭 → PAGE-12 / 봉투 바 탭 → PAGE-23 · 캘린더 탭 → PAGE-24 · 코치 탭 → PAGE-31(P1) · 코인 배지 → PAGE-30(P1) · 상점 버튼 → PAGE-29(P1)
```

**푸시 딥링크 매핑** (`notiType` → 화면). FCM `data.type` 의 실제 값은 API 명세에 없어 백엔드 확인 필요(TBD).

| notiType | 진입 화면 | refId |
| --- | --- | --- |
| `COACHING` | PAGE-10 홈(코치 말풍선) | coachingLogId |
| `BUDGET_ALERT` | PAGE-12 예산 또는 PAGE-23 봉투 상세 | envelopeId |
| `TRANSFER_REQUEST` | PAGE-25 이체 승인 | transferId |
| `CLEANUP` | PAGE-22 미확정 정리 | 없음 |
| `WARNING` | PAGE-24 캘린더 | fixedExpenseId(추정, TBD) |

## 4. 화면 공통 상태 규칙

`AGENTS.md` 완료 기준(로딩·빈·오류·비활성·중복 실행 방지)을 KeyFin 화면에 적용한 규칙이다. 화면마다 아래를 모두 구현해야 완성으로 본다.

| 상황 | 규칙 |
| --- | --- |
| 로딩 | `Skeleton`. 방 씬은 바닥·가구를 먼저 그리고 서버 데이터(보드·아바타 착장)만 스켈레톤 |
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

## 6. 미결·TBD (프론트에 영향 있는 것만)

| # | 항목 | 출처 | 프론트 대응 |
| --- | --- | --- | --- |
| 1 | **방 가구 배치 API 없음** — 팀 API 명세의 GAME 도메인은 `PUT /items/{userItemId}/equip` 과 `user_items.slot`(문자열 자리, 임시값 `SOFA`/`TABLE`/`DECO`) 뿐이다. 개인 노션의 `PUT /room/layout`(x·y 좌표 통째 저장)은 팀 명세에 없다 | API 명세서 · ERD 18 · 미결 #12 | `features/room` 의 드래그 배치(씬 좌표)를 유지하려면 백엔드에 `PUT /room/layout` 추가를 요청하거나, 슬롯 기반 배치로 바꿔야 한다. 결정 전까지 배치는 클라이언트 상태(Zustand)에만 둔다 |
| 2 | `reaction.type`·`assetKey`·`themeCode` 값 목록, 아트 스타일(3D풍 vs 2D) | API 명세서 · 미결 #12 | 백엔드 확정 후 `features/room/catalog.ts` 에 매핑 |
| 3 | FCM `data.type` 값과 딥링크 파라미터 | API 명세서(FCM 토큰) | §3 표는 `notiType` 기준 추정 |
| 4 | 에러 `code` 카탈로그 — 확인된 건 `ERR_LOGIN_FAIL` 뿐, 나머지는 공통 401/403/404/409 | API 명세서 | `errors.ts` 는 확인된 코드만 넣고 나머지는 서버 `message` 폴백 |
| 5 | Pencil 시안 없는 화면(PAGE-01·02·05·07·20~32) | design-map.json | 시안이 생기면 `design-map.json` 에 노드 id 를 넣고 대조 |
| 6 | 예산 초과 패널티, 월 코인 공식, 커스터마이징 충돌 규칙, 코치 말투 가이드, 카드 할부 재현, 질문 빈도, 상점 밸런싱 | 요구사항 미결 #1~#8 · 미결 사항 정리 C | P1 이후. 화면을 미리 만들지 않는다 |
| 7 | `app/character/register.tsx`, `app/account/[accountId].tsx`, `app/transfer/*`, `GET /home/summary` 처리 | §2 정리 대상 | 사용자 결정 |
