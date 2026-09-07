# 핀테크 UI 패턴 체크리스트

각 항목은 "구현 시 확인"과 "테스트 케이스"로 나뉜다. 값(색·크기)은 토큰 이름으로만 적는다.

## 1. AmountText

구현
- props: `value: string`(원 단위 정수 문자열), `size: 'lg' | 'md' | 'sm'`, `sign?: 'auto' | 'always' | 'never'`, `hidden?: boolean`
- 포맷은 `lib/money.ts#formatKRW`만 사용. 출력 예: `-30,000원`, `+1,250,000원`
- 색: 음수 `text-destructive`, 양수(sign 표시 시) `text-positive`, 그 외 `text-foreground`
- className: `text-amount-{size} tabular-nums`
- `hidden`이면 `••••••원`, `accessibilityLabel="잔액 숨김"`
- `maxFontSizeMultiplier={1.3}`

테스트
- `"0"` → `0원`, 색 `text-foreground`
- `"-1"` → `-1원`
- `"123456789012"` → 자릿수 콤마 정확
- hidden 상태 접근성 라벨

## 2. AmountInput

구현
- 상태는 문자열(숫자만). 표시값은 콤마 포맷, 커서는 항상 끝
- `keyboardType="number-pad"`, `inputMode="numeric"`, `maxLength`는 콤마 포함 길이
- 한도(`max`) 초과 시 즉시 필드 아래 `text-body-sm text-destructive` 오류 + 입력 유지
- 빠른 금액 칩(`+1만`, `+5만`, `+10만`, `전액`)은 `Pressable`, 44pt, `accessibilityRole="button"`
- 0 또는 빈 값이면 CTA 비활성

테스트
- 붙여넣기 `"1,000abc"` → `"1000"`
- 선행 0 제거
- 한도 초과 오류 표시·해제
- 칩 누적 합산이 `lib/money.ts#addKRW` 결과와 일치

## 3. AccountCard

구현
- 은행 로고(20pt) + 은행명 `text-label text-muted-foreground`, 별칭 `text-h3`
- 계좌번호는 `lib/mask.ts#maskAccount` 결과, 옆에 복사 버튼(`accessibilityLabel="계좌번호 복사"`)
- 잔액 `AmountText size="md"`, 숨김 토글(눈 아이콘)
- 컨테이너 `bg-card rounded-xl p-4 border border-border`, 선택 상태 `border-ring`, 눌림 `bg-muted`
- `accessibilityRole="button"`, 라벨에 별칭·은행·마스킹 번호 포함

테스트
- 마스킹 형식
- 숨김 토글 시 라벨 변화
- 눌림·선택 상태 스타일

## 4. TransactionRow / 목록

구현
- `FlatList` + 날짜별 `SectionList` 헤더(`text-caption text-muted-foreground`)
- 좌: 상대방 `text-body`, 메모·시각 `text-body-sm text-muted-foreground`
- 우: 금액 `AmountText size="sm" sign="always"`, 아래 잔액 `text-caption text-muted-foreground/70`
- 상태 `pending`: 금액 `text-muted-foreground` + "처리 중" 배지, `failed`: "실패" 배지 `bg-destructive-muted text-destructive`
- 무한 스크롤은 `useInfiniteQuery`, 하단 로딩 인디케이터, 끝 도달 시 "마지막 거래입니다"
- 행 높이 고정(72) → `getItemLayout`

테스트
- 상태 4종 렌더
- 빈 목록 `EmptyState`
- 커서 페이지네이션 2페이지 이상

## 5. 이체 플로우

구현
- 라우트: `app/transfer/recipient.tsx` → `amount.tsx` → `confirm.tsx` → `auth.tsx` → `complete.tsx`
- 상태는 `features/transfer/store.ts`(Zustand) 한 곳. 화면 이탈 시 초기화 정책 명시
- `confirm` 진입 시 `idempotencyKey = uuid()` 생성해 store에 저장. 재시도에도 동일 키
- `confirm` CTA 누르면 → `auth`(PIN/생체) → 성공 시 `useTransferMutation` 호출. `retry: 0`
- 네트워크 오류: "처리 여부 확인 중" 화면 → `GET /transfers/{key}` 폴링(최대 3회) → 결과 화면
- `complete`는 뒤로가기로 `confirm`에 돌아갈 수 없게 스택 리셋
- 딥링크로 `recipient`/`amount`가 들어오면 검증 후 `confirm`부터 시작하되 CTA는 반드시 사용자가 누른다

테스트
- 더블탭 시 mutation 1회
- 네트워크 오류 후 같은 멱등성 키로 조회
- 스택 리셋 후 뒤로가기 동작

## 6. 확인 화면 (Confirm)

구현
- 상단 "OO님에게" `text-h2`, 금액 `AmountText size="lg"` 중앙
- 정보 목록(`ListGroup`): 받는 계좌(마스킹), 출금 계좌, 수수료, 도착 예정, 메모
- 하단 고정 CTA `Button variant="primary" size="lg"` "이체하기", 안전 영역 위, `isPending` 시 비활성 + 스피너
- 백그라운드 진입 시 화면 블러(민감 화면)

## 7. PinPad

구현
- 6자리, 점 인디케이터(`w-3 h-3 rounded-full`, 채움 `bg-primary`, 빈 `bg-border`)
- 키 3×4, 각 키 `min-h-touch`, `accessibilityRole="keyboardkey"`, 숫자 라벨
- 셔플 옵션(`shuffle` prop), 삭제 키, 전체 삭제 롱프레스
- 실패 시 인디케이터 흔들림(Reanimated, 220ms) + 햅틱 + "PIN이 일치하지 않습니다 (2/5)" `text-destructive`
- 입력값은 상태에 잠시만 보관하고 검증 요청 후 즉시 지운다. 로그 금지

테스트
- 6자리 입력 완료 콜백 1회
- 삭제 동작
- 실패 횟수 표시

## 8. 생체 인증

구현
- `expo-local-authentication`: `hasHardwareAsync` → `isEnrolledAsync` → `authenticateAsync({ disableDeviceFallback: true })`
- 실패·취소·미등록 → PinPad 표시
- 성공은 클라이언트 게이트일 뿐, 서버 인증 토큰 발급은 별도 요청

## 9. 오류 · 빈 상태

구현
- `EmptyState`: 아이콘(lucide 40pt `text-muted-foreground/70`), 제목 `text-h3`, 설명 `text-body-sm text-muted-foreground`, 액션 버튼 최대 1개
- 네트워크: "연결을 확인해 주세요" + 재시도(중복 방지), 오프라인 배너는 화면 상단 `bg-inverse text-inverse-foreground`
- 세션 만료: 로그인 후 원래 화면 복귀(`redirect` 파라미터)
- 부분 실패: 실패 영역만 대체 UI, 나머지 정상 표시

## 10. 스켈레톤

구현
- `Skeleton` 컴포넌트: `bg-muted rounded-md`, 실제 요소와 동일 크기
- 300ms 이내 응답이면 표시하지 않음(깜빡임 방지)
- 목록은 5행, 카드는 카드 형태
