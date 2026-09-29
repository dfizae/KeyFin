---
paths:
  - "package.json"
  - "pnpm-lock.yaml"
  - "eslint.config.js"
  - "eslint.config.mjs"
  - "eslint.config.ts"
  - "tsconfig.json"
  - "tsconfig.*.json"
  - "app.json"
  - "babel.config.js"
  - "metro.config.js"
  - "jest.config.js"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "tests/**"
---

# 의존성, 설정 및 테스트

## 의존성

- 패키지 작업은 `pnpm`으로만 수행한다.
- 네이티브 모듈이 포함되거나 Expo SDK 버전에 민감한 패키지는 `pnpm add`가 아니라 `pnpm expo install`로 설치해 호환 버전을 맞춘다.
- lockfile(`pnpm-lock.yaml`)을 직접 수정하지 않는다.
- 이미 설치된 라이브러리로 해결 가능한 문제에 동일한 목적의 새 라이브러리를 추가하지 않는다.
- 새로운 패키지 설치, 기존 패키지 제거, 주요 버전 변경, Expo SDK 업그레이드 전에는 확인을 요청한다.
- 오류를 없애기 위해 ESLint 또는 TypeScript 규칙을 비활성화하거나 완화하지 않는다.

## 테스트

**범위(사용자 결정 2026-09-08): 새 테스트는 `features/<domain>/model.ts` 의 순수 함수·계약 변환에만 쓴다.** 화면 통합 테스트(`*.test.tsx`)는 요청이 있을 때만 새로 만든다 — 산출 코드량 대비 비용이 커서 줄이기로 했다.

- 새 도메인의 `model.ts` 를 만들면 계약 사본의 예시 응답으로 변환·검증 테스트를 함께 쓴다. `null` 필드, 모르는 열거형(`UNKNOWN` 흡수), 금액·날짜 형식 위반(`ContractMismatchError`), 커서 경계(`nextCursor: null`)를 포함한다.
- 기존 `*.test.tsx` 는 그대로 두고, 건드린 화면의 동작이 바뀌면 깨지지 않게 고친다. 통과를 목적으로 삭제하거나 검증 수준을 낮추지 않는다.
- 테스트 도구는 `jest-expo` + React Native Testing Library다. 승인 없이 다른 테스트 프레임워크를 설치하지 않는다.
- 테스트는 내부 구현 세부 사항보다 겉으로 확인할 수 있는 동작을 검증한다.
- 검증 명령을 실행하지 못한 경우 실행한 것처럼 보고하지 않는다.
