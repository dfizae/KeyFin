---
paths:
  - "app/**"
  - "components/**"
  - "features/**"
  - "hooks/**"
  - "lib/**"
  - "global.css"
  - "tailwind.config.js"
  - "babel.config.js"
  - "metro.config.js"
  - "app.json"
---

# React Native 기본 규칙

- 코드 작성, 수정, 리뷰 전에 `docs/frontend-code-quality.md`와 `docs/frontend_clean_code_guide.md`의 관련 기준을 확인한다. 두 문서의 예시는 웹 기준이므로 원칙만 React Native에 맞게 적용한다.
- 명세나 사용자 요청에 없는 기능은 추가하지 않는다.
- 기존 프로젝트의 디렉토리 구조, 컴포넌트 패턴, 명명 규칙을 우선 따른다.
- 스타일링은 NativeWind 유틸리티(`className`)와 `tailwind.config.js` 테마 토큰만 사용한다. 테마는 `design/tokens.json`에서 생성되므로 `tailwind.config.js`를 직접 수정하지 않는다.
- `div`, `button`, `input` 같은 HTML 요소와 `document`, `window`, `localStorage` 같은 웹 전용 API를 사용하지 않는다.
- 컴포넌트와 화면에서 `fetch`, `axios` 또는 도메인 API 함수를 직접 호출하지 않는다.
- 서버 데이터는 TanStack Query로 관리하고, `useEffect`와 `useState`에 요청 결과를 저장하지 않는다.
- 요청 범위와 관계없는 코드 정리나 리팩터링을 함께 수행하지 않는다.
