---
paths:
  - "api/**"
  - "features/**/api/**"
  - "**/queries/**/*.ts"
  - "**/mutations/**/*.ts"
  - "**/*.query.ts"
  - "**/*.mutation.ts"
  - "openapi/**"
---

# 백엔드(Java) API 계약

백엔드는 같은 저장소 `backend/`의 Java(Spring)이며 백엔드 팀이 담당한다. 계약의 원천은 팀 Notion 의 **API 명세서·ERD** 이고, 백엔드가 OpenAPI 를 내보내면 그 파일이 원천이 된다. 이 규칙은 계약을 소비하는 클라이언트 코드에 적용한다. Base path 는 `/api/v1` 이며 `api/client.ts` 가 붙인다.

## 계약 원천

- OpenAPI 가 나오기 전까지 클라이언트 쪽 계약 사본은 `docs/api-contract.md`(Notion 대조 일시 명시)다. OpenAPI 스펙이 제공되면 `openapi/openapi.yaml`(또는 `.json`)로 복사본을 두고 버전(`info.version`)과 출처 커밋을 `openapi/README.md`에 기록한 뒤 `docs/api-contract.md` 는 삭제한다.
- `api/generated/`는 스펙에서 생성한 타입·클라이언트 코드다. 직접 수정하지 않고 `pnpm api:generate`로 재생성한다. 생성 도구(`openapi-typescript` 등)의 도입은 승인 후 진행한다.
- 스펙에 없는 엔드포인트, 필드, 상태값을 클라이언트에서 임의로 가정하지 않는다. 필요한 변경은 백엔드에 요청하고 보고서에 `TBD`로 남긴다.
- 스펙과 실제 응답이 다르면 클라이언트에서 우회하지 않고 불일치를 보고한다.

## DTO와 화면 모델

- 요청 DTO, 응답 DTO는 계약 사본(또는 생성된 타입)을 그대로 쓰고, 화면에서 쓰는 모델은 `features/<domain>/model.ts`에서 변환한다. 화면 컴포넌트가 DTO 필드명에 직접 의존하지 않게 한다.
- 명명은 `camelCase`(계약 확정)이며 클라이언트에서 변환 레이어를 두지 않는다. 성공 응답에는 봉투(`success`/`data`)가 없고 본문이 곧 데이터다. 빈 본문 성공(`200`/`201`)은 `void` 로 다룬다.
- 금액 필드는 **원 단위 정수의 JSON number(Long)** 다. `model.ts` 에서 `Number.isSafeInteger` 로 검증한 뒤 `lib/money.ts` 의 `KRW`(문자열)로 바꿔 화면에 넘긴다. 잔액·잔여율·부족액·코인 잔액 같은 서버 파생값은 검증만 하고 클라이언트에서 다시 계산하지 않는다.
- 날짜·시각은 계약 사본의 형식(`YYYYMM`, `YYYY-MM-DD`, `HH:mm:ss`, 시간대 없는 `YYYY-MM-DDTHH:mm:ss` = KST)을 그대로 받고 화면 모델 변환 시점에만 파싱한다. 시간대 없는 값은 `+09:00` 을 붙여 파싱한다.
- 열거형(거래 상태, 계좌 종류 등)은 스펙의 값을 유니온 타입으로 두고, 스펙에 없는 값이 오면 `UNKNOWN`으로 흡수해 화면이 깨지지 않게 한다.

## 오류 응답

- 백엔드 오류 봉투는 `{ code: string, message: string }` + HTTP 상태다(계약 확정, `traceId` 없음). 다른 형태가 오면 계약 불일치로 보고한다.
- `code`는 화면 분기(로그인 실패 `ERR_LOGIN_FAIL`, 중복 이메일 409 등)에 사용한다. 사용자 문구는 `features/<domain>/errors.ts`에서 `code`별로 정의하고, 정의가 없는 `code` 는 서버 `message`(백엔드가 금융망 오류까지 사용자 문구로 변환해 준다)를 폴백으로 보여준다. `message` 를 파싱해 분기하지 않는다.
- HTTP 401은 `POST /auth/refresh`(body `{ refreshToken }`)로 갱신 후 1회 재시도하고, 갱신 실패 시 토큰을 지우고 로그인으로 이동한다. 갱신은 단일 실행(동시 401 은 같은 Promise 를 기다린다). 403은 재시도하지 않는다. 409는 계약 사본의 뜻(중복 이메일, 이미 연결 등)대로 문구를 보여준다.

## 인증 헤더와 공통 규약

- 공통 헤더는 `Authorization: Bearer <accessToken>`(Access 30분, Refresh 14일) 하나이며 `api/client.ts` 인터셉터에서만 붙인다. `/auth/signup`·`/auth/login`·`/auth/refresh` 는 제외한다. 개별 API 함수에서 헤더를 조립하지 않는다. 멱등성 키 헤더는 없고, 이체·연결·코인의 중복 실행은 서버(기관거래고유번호·유니크 제약)가 막는다. 클라이언트는 `isPending` 동안 같은 요청을 다시 보내지 않는다.
- 페이지네이션은 커서 방식(`cursor` = 마지막 조회 id, `size` 기본 20, 응답 `{ items, nextCursor: number | null }`)이며 TanStack Query `useInfiniteQuery`와 연결한다.
- 요청 타임아웃은 조회 10초, 돈이 움직이는 요청 30초를 기본으로 하되 `api/client.ts`에 상수로 둔다.
- 서버 시각·기기 시각 차이가 큰 경우를 대비해 응답 헤더 `Date`로 오프셋을 보정하는 로직은 `lib/date.ts`에 둔다.

## 목 서버와 테스트

- 백엔드가 준비되지 않은 엔드포인트는 도메인 함수의 `USE_MOCKS` 분기(`EXPO_PUBLIC_API_URL` 이 비면 켜짐)로 대체하고, 목 데이터는 `api/mocks/`에 계약 사본의 응답 예시를 그대로 옮겨 두며 실제 계좌·개인 정보를 넣지 않는다. `msw` 등 목 서버 도입은 승인 후 진행한다.
- API 함수·모델 테스트는 계약 사본의 예시 응답을 기준으로 작성하고, 오류 봉투, `null` 필드(미승인 월 예산 등), 페이지네이션 경계(`nextCursor: null`)를 포함한다.
