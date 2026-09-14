# 앱과 AI 코칭 서비스 연결

일반 금융 질문, 개인 자료 조회, 예측 코칭을 같은 대화 화면에서 받는 앱 연결 코드다. **구현·로컬 HTTP 검증·실제 GPU 응답 계약 검증과 실제 서비스 배포는 서로 다른 상태**다. 이 문서는 2026-09-14 기준으로 확인된 범위와 남은 연결 작업을 구분한다.

## 코드를 읽는 순서

| 역할 | 경로 | 책임 |
| --- | --- | --- |
| 앱 진입 | `frontend/app/coach.tsx`, `coach-notifications.tsx` | 앱 로그인·약관 상태 검사. 금융 연결 전에도 일반 질문 진입 허용 |
| 화면·대화 상태 | `frontend/features/coaching/components/`, `useCoachingChat.ts` | 빈 대화, 연속 질문, 대기·실패·재시도, 원래 코칭 열기 |
| 앱 HTTP 경계 | `frontend/features/coaching/api.ts`, `model.ts` | 기존 JWT 클라이언트 사용, Zod 응답 검사, 출처·자료 상태·예측 날짜 표시 |
| 보호 프록시 | `backend/key-fin/.../coaching/CoachingController.java`, `CoachingClient.java` | 인증 주체로 소유자 토큰 선택, 고정 API 경로, 제한 시간·크기·오류 처리 |
| 서버 전용 자료 입력 | `CoachingDataBridge.java`, `PersonalContextInput.java`, `EngineInput.java` | 소유자별 쓰기 토큰과 정확한 입력 외곽 계약 |
| 실행 설정 예 | `backend/key-fin/src/main/resources/application-coaching-example.properties` | 기본 비활성, 비밀값 없는 서버 설정 예 |
| 테스트 | `frontend/features/coaching/__tests__/`, `backend/key-fin/src/test/java/com/finset/key_fin/coaching/` | 파서·화면 동작·대화·HTTP·권한 선택·자료 계약 회귀 |

코드 경로의 `.../coaching/`는 `src/main/java/com/finset/key_fin/coaching/`다. 테스트 코드와 실행 코드를 분리했다. 원본 응답, 번들, 로그는 각각 별도 실험 저장소 또는 무시되는 `.expo/qa/`·Gradle `build/`에 보관하며 소스에 넣지 않는다.

```mermaid
flowchart TD
    A[앱 로그인 JWT] --> B[AI 금융 코칭 화면]
    B --> C[기존 앱 API 클라이언트]
    C --> D[Spring 인증 주체 Long user ID]
    D --> E[소유자별 AI 읽기 토큰]
    E --> F[Python 대화 API]
    F --> G{질문 분류}
    G --> H[금융 출처 및 개인 현황]
    G --> I[FDT 수치 엔진 및 내부 소비 이력 예측]
    H --> J[ChatAnswer]
    I --> K[Coaching 및 Receipt]
    J --> L[응답 파서와 상태 표시]
    K --> L
    M[승인된 원천자료 변환기 - 후속 연결] --> N[서버 전용 typed bridge]
    N --> O[같은 소유자의 별도 쓰기 토큰]
    O --> P[Python Bootstrap / Event / PersonalContext]
    P --> I
    I --> Q[코칭 알림 outbox]
    Q --> R[앱 알림함]
    R --> S[원래 코칭 로드 성공 후 읽음 확인]
    S --> B
```

## 화면에서 유지하는 계약

- 빈 대화는 `POST /sessions`에 `{}`를 전달한다. 일반 금융 질문에 과거 코칭 ID가 필요하지 않다.
- 후속 질문은 같은 서버 세션을 사용한다. 응답을 기다리는 동안 중복 전송을 막고, 불확실한 실패 후 재시도는 같은 생성 키·질문 키를 사용한다.
- 서버의 `needs_source`, `needs_data`, `out_of_scope`, `unavailable`, `needs_clarification`을 성공 문구로 바꾸지 않는다. 개인 현황 `personal_context`에 출처 목록이 없는 경우도 받는다.
- `Receipt`가 있다는 이유만으로 미래 예측 성공으로 표시하지 않는다. 결제·정기 코칭은 ‘코칭’으로 표시하고 수치 결과의 `partial`·`insufficient_data`를 구분한다.
- 예측 기간은 **`forecast_start`부터 `forecast_end`까지**다. 예를 들어 기준일 9월 3일의 월말 요청에서 요청 구간은 9월 1~30일이어도 미래 구간은 9월 4~30일이다. 화면에서 다시 30일을 더하거나 월초를 미래 시작일로 사용하지 않는다.
- 알림함은 Python의 `type=COACHING` 계약을 읽는다. 원래 코칭 조회가 성공한 뒤에만 읽음 확인을 요청하고, 후속 대화는 그 코칭 ID로 시작한다.
- 저장된 세션은 `message.response`의 종류·ID로 원래 답변을 조회해 출처·Receipt·기간·자료 상태를 복원한다. 일부 조회가 실패하면 해당 메시지의 저장된 본문을 유지하고 재시도를 제공한다. 참조가 없는 레거시 메시지는 ‘저장된 답변’으로 구분한다. 요청과 다른 ID·종류의 응답은 표시하지 않는다.
- 앱 API 설정이 없으면 ‘서버가 아직 연결되지 않았다’는 오류를 표시한다. 테스트용 금융 답변을 정상 응답으로 생성하지 않는다.

## 앱 API와 서버 API

모든 앱 경로는 `/api/v1/coaching` 아래이며 기존 `BaseResponse`에 원본 AI JSON을 담는다.

| 앱 메서드·상대 경로 | Python 경로 |
| --- | --- |
| POST `/sessions` | `/v1/sessions` |
| GET `/sessions/{id}` | `/v1/sessions/{id}` |
| POST `/sessions/{id}/messages` | `/v1/sessions/{id}/messages` |
| POST `/questions` | `/v1/finance/questions` |
| POST `/personal/questions` | `/v1/personal/questions` |
| GET `/answers/{id}` | `/v1/answers/{id}` |
| GET `/records/{id}` | `/v1/coaching/{id}` |
| GET `/notifications` | `/v1/notifications` |
| POST `/notifications/{id}/ack` | `/v1/notifications/{id}/ack` |

앱에는 AI/GPU 주소나 토큰을 제공하지 않는다. `coaching.user-tokens[앱 사용자 ID]`는 Python의 같은 소유자에 발급된 user-role 토큰이어야 한다. `backend-tokens`는 동일 소유자의 별도 backend-role 토큰이다. **알림함·읽음 확인은 별도 `notification-tokens`를 사용한다.** Python은 user-role 토큰의 알림 접근을 403으로 거절하며, 알림 토큰이 없을 때 사용자·쓰기 토큰으로 우회하지 않는다. 모든 역할·소유자의 토큰이 서로 다른지 시작 시 검사하며, 필요한 매핑이 없으면 요청 전에 503으로 거절한다. 정확한 소유자 ID와 토큰 역할의 실제 발급·배포 매핑은 배포 담당자가 확인해야 한다. 브라우저가 입력한 사용자 ID로 매핑을 바꾸는 API는 없다.

쓰기 토큰은 `CoachingDataBridge`만 사용한다. 이 메서드를 거래 동기화 서비스에 연결할 때도 인증·도메인에서 확정한 소유자를 전달해야 한다. 사용자가 업로드한 JSON으로 전체 금융 상태를 교체하는 공개 컨트롤러는 제공하지 않는다.

상위 서버는 미리 설정한 HTTP(S) origin만 사용하며 리다이렉트를 따르지 않는다. 운영망의 전송 구간은 TLS 또는 승인된 내부망 설정을 적용해야 한다. 연결 제한 5초, 전체 응답 기본 제한 60초(최대 2분), 응답 크기 상한 8MiB를 둔다. 헤더가 먼저 도착해도 본문 수신까지 전체 제한이 적용된다. 원본 에러 본문·인증 헤더는 사용자 응답이나 로그에 넣지 않는다.

## 자료 동기화에서 구현한 부분과 남은 부분

`PersonalContextInput`은 보험·소득·고정비·목표를 원 단위 정수, 기준일, 원천 시스템·레코드, 자료 범위, revision으로 받는다. 자료 범위 `unknown`은 빈 항목이어야 하며 같은 항목 ID가 중복되면 거절한다. `complete`는 원천 시스템이 해당 범위를 제공했다는 표시이며 독립적인 금융 검증 완료를 뜻하지 않는다. 계좌·자산·부채·예정 결제는 기존 FDT 스냅샷을 이용한다.

`EngineInput.Bootstrap`과 `EngineInput.Event`는 Python의 외곽 계약을 제공한다. 내부 거래·스냅샷 문서는 손실 없이 전달하고 정식 FDT 정규화·소유권 검사를 통과해야 한다. 임의의 카드 결제와 대금 정산을 합치거나 지출로 간주하는 변환은 하지 않는다.

현재 작업 브랜치에서 확인한 거래 엔티티만으로는 계좌 현재 잔액·현재 봉투 잔액·카드 사용과 정산·취소의 전체 원천 매핑이 확정되지 않는다. 따라서 **DB 변경 이벤트를 자동으로 읽어 이 bridge를 호출하는 실제 원천 어댑터는 아직 연결되지 않았다.** 최신 develop의 원천 모델을 통합한 뒤 실제 소유자·통화·7개 봉투·이중 차감·취소·revision 재시도 계약을 확인하고 구현해야 한다.

## 검증 기록과 한계

- 앱 코칭 모델·API·대화 상태 18건 통과. 빈 세션, 같은 세션의 연속 질문, 타임아웃 재시도 키, 알림 원본 조회 전 읽음 방지, 기간·상태, 재접속 근거 복원과 일부 복구 실패를 검사했다.
- 실제 컴포넌트 테스트 3건 통과. 빈 화면 질문 보내기, 자료 부족 표시, 알림 열기 경로를 검사했다. 이는 모바일·브라우저의 실제 픽셀 렌더 검증과 다르다.
- Spring 보호 프록시·자료 bridge·응답 크기 검사 20건 통과. 로컬 실제 HTTP 수신기로 별도 소유자·알림 역할 토큰, 원문 수치·날짜, 전체 본문 제한 시간, 실패 상태를 검사했다. 운영 Spring 인증 서버와 GPU를 직접 연결한 배포 스모크는 아니다.
- 별도 임시 DB를 사용하는 실제 Python FastAPI ASGI 라우트에서도 user 세션 생성 200, user 알림 목록·읽음 확인 403/403, notification 알림 목록·읽음 확인 200/200을 재현했다. 이 권한 검사는 주입한 테스트 모델을 사용하며 GPU 추론 성능 시험으로 집계하지 않는다.
- 실제 GPU 추론을 거친 합성 사용자 API 응답 7종을 변경 없이 읽는 선택 실행 테스트가 7/7 통과했다. 금융 개념·개인 계좌·미연결 계좌·비금융 범위·취소 후 지출·예측·위험 응답이다. 원본은 실험 저장소에 보관하고 테스트는 SHA-256만 기록한다. `COACHING_API_FIXTURE_DIR`가 없으면 이 7건을 생략하며, 일반 CI의 고정 21건(위 18건 + 컴포넌트 3건)과 분리한다. 최종 실행은 28/28이다.
- TypeScript 검사와 코칭 범위 ESLint, `pnpm@11.13.0 install --frozen-lockfile`이 통과했다. 잠금 파일은 기존 해석을 유지하고 필요한 14줄만 추가했다. Zod 응답 검사, 실제 번들링에 필요한 Babel JSX 플러그인, 파일 기반 계약 테스트의 Node 타입 선언을 직접 의존성으로 명시했다.
- 최종 Expo web export 성공. 첫 실행에서 Metro 캐시 역직렬화 실패 후 전체 재탐색으로 복구했고 색상 환경 경고가 있었다. 최종 `--clear` 빌드에서는 의도한 빈 캐시 재생성 안내만 남았으며, 로그의 `error.*.png`는 Expo Router 정적 이미지 이름임을 원문으로 확인했다. 배포 빌드 성공은 실제 화면 동작 확인을 대신하지 않는다.
- 홈·금융연결을 포함한 확대 실행은 50개 테스트가 통과했지만 테스트 후 열린 비동기 핸들 때문에 프로세스가 종료되지 않아 중단했다. 확대 실행을 깨끗한 종료 성공으로 집계하지 않는다. 별도 코칭 28건 실행은 종료 코드 0까지 확인했다.
- 정상 localhost Expo 화면 접근 중 CDP 시간초과와 연결 오류가 발생했고, 브라우저가 만든 `data:` 오류 페이지는 URL 정책에 의해 차단됐다. 차단된 페이지에 우회 접근하지 않았다. **실제 데스크톱·모바일 화면 렌더와 실제 인증 후 화면 왕복은 미검증이다.**
- OS 푸시(FCM 등) 실제 발송, 실제 고객의 미래 금융 정확도, 원본 차트의 앱 내 임베딩은 이 연결 코드의 검증 범위에 포함되지 않는다.

재현 명령은 각 디렉터리에서 실행한다. 테스트 자료·서버 토큰은 소스에 추가하지 않는다.

최종 로컬 증거 캡슐은 계정의 `artifacts/tool-output`에 보관한다. 원본 응답·절대 사용자 경로·인증값을 MR에 첨부하지 않는다.

| 검증 | 캡슐 ID | 종료 상태 |
| --- | --- | --- |
| 코칭 고정 21 + 실제 GPU 응답 7 | `20260914-143438734-0da08a36` | 28/28, exit 0 |
| Spring 모듈 및 HTTP·역할·자료 계약 | `20260914-143438768-e9a23924` | 20/20, exit 0 |
| TypeScript | `20260914-143812509-34edc6cb` | 통과 |
| 코칭·홈·금융연결 변경 파일 ESLint | `20260914-144000060-061b0ed0` | 통과 |
| 고정 잠금 파일 설치 | `20260914-143722227-11849339` | pnpm 11.13.0, 통과 |
| 초기 web export | `20260914-142245265-b930576f` | 성공, 캐시 복구·색상 경고 원문 확인 |
| 최종 web export | `20260914-143911428-7465800f` | 성공, 캐시 재생성 안내·정적 자산 이름 원문 확인 |
| 홈·금융연결 확대 실행 | `20260914-142515387-a9af6313` | 50건 통과 후 미종료, 중단 |

```powershell
# frontend
corepack pnpm@11.13.0 install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm exec eslint features/coaching app/coach.tsx app/coach-notifications.tsx
pnpm exec jest --runInBand features/coaching
# 선택: 승인된 비민감 실험 응답 디렉터리를 지정한 뒤 실행
$env:COACHING_API_FIXTURE_DIR = '<응답 fixture 디렉터리>'
pnpm exec jest --runInBand features/coaching/__tests__/recorded-api.test.ts
pnpm exec expo export --platform web --output-dir .expo/qa/export

# backend/key-fin — JDK 21
.\gradlew.bat --no-daemon test --tests '*Coaching*Test' --tests '*LimitedResponseBodyTest' --console=plain
```
