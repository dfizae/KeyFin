# FDT 코칭 API

거래 이벤트를 저장하고 예산 초과 징후를 감지하며, 코칭 카드·대화·수치 분석 결과를 제공하는 Python API입니다. **금액과 예측 구간은 팀 FDT가 계산하고, LLM은 분류와 설명을 담당합니다.** 독립 API와 앱·백엔드의 코칭 연결 코드가 있으며, 운영 인증 설정·실제 금융 데이터 동기화·푸시 전송망의 통합 검증은 남아 있습니다.

[AI·FDT 구조도](docs/architecture.md)에서 전체 구성, FDT 내부 계산, 차트 생성 순서를 Mermaid로 볼 수 있습니다.

[답변 개선과 실제 은행 원장 실험](docs/answer-forecast-improvement.md)에는 GPU 수치 전달 0/14→14/14, 공개 원장의 7일 출금 오차 17.59% 감소, 30일 개선 없음의 실행 결과와 한계를 정리했습니다.

[실제 고객 검증 계획](docs/real-customer-validation.md)에서 현재 실험 수치의 의미, 예측 개선 순서와 Jira AI 코칭 잔여 업무를 확인할 수 있습니다.

[금융 질문·소비 조회·예측 대화](docs/chat.md)에서 거래 연결 없이 대화를 시작하는 방법과 새 응답 형식을 확인합니다. [응답 검증 보고서](docs/chat-response-validation.md)는 같은 질문의 수정 전후 GPU 결과를 비교합니다.

[R14 전체 연결 검증](docs/end-to-end-validation.md)에서 공식 자료 검색·개인 현황·앱 연결·예측 사전등록의 구현 범위와 실제 GPU 실행 결과, 남은 운영 조건을 확인합니다.

[R15 기간 합계 예측 개선](docs/aggregate-forecast-r15.md)은 새 GPU 추가학습 4회와 별도 과거 원장의 최종 평가 결과입니다. 7일 총출금 MAE는 34.47%, 30일은 8.38% 감소했으며 실제 고객 소비 예측 및 FDT 교체 여부와 구분합니다. [월별 평가 API](docs/forecast-validation.md)는 원래 편성·실제 소비·예측을 같은 달 기준으로 비교합니다.

[R15 구현·성능 개선 결과](docs/coaching-completion-r15.md)에서 원천 동기화·월별 평가·후속 질문 개선의 최종 검증과 Jira 104·110의 남은 완료 조건을 함께 확인합니다.

## 빠르게 실행하기

Python 3.11~3.13과 `uv`가 필요합니다. 저장소 루트에서 PowerShell로 실행합니다.

```powershell
Set-Location ai/coaching
uv sync --locked
$taskDemoToken = (& .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(32))").Trim()
$env:COACHING_CLIENTS = ConvertTo-Json -Compress -InputObject @(@{user_id='demo';token=$taskDemoToken;role='backend'})
$env:COACHING_DATABASE = 'state/coaching.sqlite3'
uv run uvicorn coaching_service.api:from_environment --factory --host 127.0.0.1 --port 8000
```

`http://127.0.0.1:8000/healthz`에서 상태를, `/docs`에서 요청·응답 스키마를 확인합니다. `/healthz`는 오타가 아니라 API 상태 확인용으로 지정한 경로입니다. 응답의 `model_configured`는 모델 주소 설정 여부이며 GPU 추론 성공을 뜻하지 않습니다. 추론까지 확인하려면 [실제 HTTP 검증](benchmarks/coaching/e2e/README.md)을 실행합니다.

위 셸을 유지한 채 다른 터미널을 사용한다면 같은 개인 테스트 토큰을 안전하게 전달해야 합니다. 인증 헤더는 `Authorization: Bearer <테스트 토큰>`입니다. 토큰을 문서나 커밋에 복사하지 않습니다.

모델 연결을 생략하면 FDT 계산과 템플릿 설명으로 실행합니다. 실제 LLM을 사용하려면 [운영 설정](docs/operations.md)의 추론 서버를 연결합니다. HTTP 200만으로 모델이 답했다고 판단하지 말고 응답의 설명 출처와 대체 사유를 함께 확인합니다.

## 호출 순서

1. [`examples/bootstrap.json`](examples/bootstrap.json)을 `POST /v1/twin`으로 보내 초기 원장과 잔액을 저장합니다.
2. [`examples/payment.json`](examples/payment.json)을 `POST /v1/events`로 보내 거래를 반영합니다. `expected_revision`에는 조회한 현재 버전을 사용합니다.
3. 코칭 검토는 `POST /v1/coaching/reviews`, 대화 시작은 `POST /v1/sessions`, 질문은 `POST /v1/sessions/{session_id}/messages`를 사용합니다.
4. `GET /v1/notifications`로 알림 대기 항목을 읽고 실제 전달 후 `POST /v1/notifications/{event_id}/ack`로 확인합니다.

일반 금융 개념만 질문하려면 Twin 생성 없이 `POST /v1/finance/questions`를 호출하거나, `{}`로 세션을 만든 뒤 메시지를 보냅니다. 현재 공식 근거 27종을 검색하며 미지원·최신 정보는 자료 필요 상태로 구분합니다. [공식 근거 검색](docs/knowledge-retrieval.md), [개인 현황 조회](docs/personal-context.md), [예측 사전등록·실제값 비교](docs/forecast-validation.md), [앱·백엔드 연결](docs/app-integration.md)에 계약과 지원 범위를 정리했습니다. 메시지 응답은 `Coaching | ChatAnswer`이므로 앱에서 `receipt`의 존재를 무조건 가정하지 않습니다.

기존 KeyFin 차트는 `POST /v1/charts/budget-forecast`로 생성합니다. 거래를 요청에 담거나 저장된 Twin을 사용할 수 있으며, FDT 계산과 GPU 설명 추론을 거친 차트 JSON 및 원본 계산 근거를 반환합니다. [차트 연결 안내](docs/charts.md)에 요청 예시·HTML 조회·기간 및 금액 기준을 정리했습니다.

예시는 고정된 합성 날짜를 사용합니다. 이벤트 날짜와 분석 기준일을 임의로 섞지 않습니다. 최신 요청 필드와 응답 형식은 실행 중인 `/docs` 및 [`schemas.py`](src/coaching_service/schemas.py)가 기준입니다.

## 코드와 문서 찾기

| 경로 | 역할 |
| --- | --- |
| `src/coaching_service/api.py`, `routes.py` | 인증된 HTTP 경계 |
| `store.py`, `repository.py`, `events.py` | SQLite 저장·이벤트 반영·재시도 처리 |
| `engine.py`, `periods.py` | FDT 호출과 기준일·종료일 계산 |
| `coaching.py`, `dialogue.py`, `payments.py` | 코칭 발생·대화·결제 흐름 |
| `finance_knowledge.py`, `spending_history.py`, `chat_answers.py` | 공식 개념 근거, 확정 소비 집계, 예측 없는 답변 계약 |
| `knowledge_catalog.py`, `knowledge_retrieval.py`, `knowledge/` | 버전이 고정된 공식 자료와 질문별 검색 |
| `personal_*.py` | 기존 Twin과 별도 개인 현황의 권한·완전성·기준일 검사 및 조회 |
| `forecast_validation*.py` | 예측 발급 시점 저장, 만기 실제값 정산, 독립 원장 합산 및 오차 지표 |
| `llm.py`, `evidence_projection.py`, `token_budget.py` | 모델 호출·근거 선택·실제 토큰 한도 검사 |
| `admission.py`, `rendering.py`, `numeric_rendering.py` | 모델 결과 검사, 원본 수치·기간 검증 후 본문 조립, 설명 대체 |
| `chart_routes.py`, `charts.py`, `chart_contract.py`, `chart_projection.py`, `chart_rendering.py` | 고정 차트 JSON 변환, 생성·저장·HTML 조회 |
| `vendor/fdt/`, `ENGINE_MANIFEST.json` | 고정 엔진 소스와 무결성 목록 |
| `vendor/keyfin_chart/`, `CHART_MANIFEST.json` | 원래 차트 실행 자산 6개와 무결성 목록 |
| `scripts/gpu_worker.py` | 별도 추론 프로세스 실행 진입점 |
| `tests/`, `tests/forecast/` | 서비스·예측 평가기의 테스트 코드와 합성 테스트 입력 |
| `benchmarks/` | 코칭·소비 예측 성능 실험을 실행하는 코드와 고정 시나리오 입력 |
| `artifacts/` | 실행해서 만들어진 로그·결과·예측값·빌드 패키지; Git 업로드 제외 |

[코드 리뷰 안내](docs/code-review.md)에서 읽을 순서·호출 흐름·고정값의 이유·관련 테스트를 확인할 수 있습니다. [코드 재점검 결과](docs/code-audit.md), [AI·FDT 구조와 기간 계약](docs/architecture.md), [검증 결과](docs/validation.md), [운영 설정](docs/operations.md)도 함께 참고합니다. `benchmarks/`는 API의 런타임 의존성이 아닙니다.

## 검증 실행

아래 명령은 서비스 디렉터리에서 실행합니다. 두 번째 명령은 별도 모델 설치 없이 예측 평가기의 날짜·분할·점수 계산을 검사합니다.

```powershell
uv run pytest
uv run pytest tests/forecast
uv run ruff check src tests scripts benchmarks
uv run basedpyright
uv run python scripts/service_smoke.py
```

`service_smoke.py`는 임시 서버를 띄워 실제 HTTP 요청을 실행하고 `artifacts/http_smoke/`에 결과를 남깁니다. 모델 품질을 평가하려면 [별도 벤치마크](benchmarks/README.md)를 실행해야 합니다.
