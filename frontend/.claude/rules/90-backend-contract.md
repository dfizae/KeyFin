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

백엔드는 Java(Spring) 별도 저장소이며, 두 저장소의 계약은 **OpenAPI 스펙 파일**이다. 이 규칙은 스펙을 소비하는 클라이언트 코드에 적용한다.

## 계약 원천

- OpenAPI 스펙은 백엔드 팀이 소유한다. 클라이언트 저장소에는 `openapi/openapi.yaml`(또는 `.json`)로 복사본을 두고 버전(`info.version`)과 출처 커밋을 `openapi/README.md`에 기록한다.
- `api/generated/`는 스펙에서 생성한 타입·클라이언트 코드다. 직접 수정하지 않고 `pnpm api:generate`로 재생성한다. 생성 도구(`openapi-typescript` 등)의 도입은 승인 후 진행한다.
- 스펙에 없는 엔드포인트, 필드, 상태값을 클라이언트에서 임의로 가정하지 않는다. 필요한 변경은 백엔드에 요청하고 보고서에 `TBD`로 남긴다.
- 스펙과 실제 응답이 다르면 클라이언트에서 우회하지 않고 불일치를 보고한다.

## DTO와 화면 모델

- 요청 DTO, 응답 DTO는 생성된 타입을 그대로 쓰고, 화면에서 쓰는 모델은 `features/<domain>/model.ts`에서 변환한다. 화면 컴포넌트가 DTO 필드명에 직접 의존하지 않게 한다.
- Java 쪽 명명(`snake_case` 또는 `camelCase`)은 스펙을 따르며 클라이언트에서 임의로 변환 레이어를 두지 않는다. 변환이 필요하면 `api/client.ts` 인터셉터 한 곳에서 한다.
- 금액 필드는 스펙상 `string`(BigDecimal 직렬화)이다. 클라이언트 타입에서 `number`로 바꾸지 않는다.
- 날짜·시각은 ISO-8601 문자열로 받고 화면 모델 변환 시점에만 파싱한다.
- 열거형(거래 상태, 계좌 종류 등)은 스펙의 값을 유니온 타입으로 두고, 스펙에 없는 값이 오면 `UNKNOWN`으로 흡수해 화면이 깨지지 않게 한다.

## 오류 응답

- 백엔드 오류 봉투는 `{ code: string, message: string, traceId: string, details?: … }` 형태로 합의한다. 다른 형태가 오면 계약 불일치로 보고한다.
- `code`는 화면 분기(잔액 부족, 한도 초과, 인증 만료 등)에 사용하고 `message`는 사용자에게 그대로 보여주지 않는다. 사용자 문구는 클라이언트의 `features/<domain>/errors.ts`에서 `code`별로 정의한다.
- `traceId`는 오류 화면의 "문의 코드"로 표시할 수 있고, 로그에 남길 수 있는 유일한 서버 식별자다.
- HTTP 401은 토큰 갱신 후 1회 재시도, 갱신 실패 시 로그인으로 이동한다. 403은 재시도하지 않는다. 409(멱등성 충돌)는 기존 결과를 조회해 표시한다.

## 인증 헤더와 공통 규약

- `Authorization: Bearer <accessToken>`, `Idempotency-Key`, `X-Device-Id`, `Accept-Language` 같은 공통 헤더는 `api/client.ts` 인터셉터에서만 붙인다. 개별 API 함수에서 헤더를 조립하지 않는다.
- 페이지네이션은 커서 방식(`cursor`, `size`, 응답 `nextCursor`)을 기본으로 하고 TanStack Query `useInfiniteQuery`와 연결한다.
- 요청 타임아웃은 조회 10초, 돈이 움직이는 요청 30초를 기본으로 하되 `api/client.ts`에 상수로 둔다.
- 서버 시각·기기 시각 차이가 큰 경우를 대비해 응답 헤더 `Date`로 오프셋을 보정하는 로직은 `lib/date.ts`에 둔다.

## 목 서버와 테스트

- 백엔드가 준비되지 않은 엔드포인트는 스펙 기반 목(`msw` 등, 도입은 승인 후)으로 대체하고, 목 데이터는 `api/mocks/`에 두며 실제 계좌·개인 정보를 넣지 않는다.
- API 함수 테스트는 스펙의 예시 응답을 기준으로 작성하고, 오류 봉투와 페이지네이션 경계를 포함한다.
