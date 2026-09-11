# FDT 코칭 API

거래 이벤트를 저장하고 예산 초과 징후를 감지하며, 코칭 카드·대화·수치 분석 결과를 제공하는 Python API입니다. **금액과 예측 구간은 팀 FDT가 계산하고, LLM은 분류와 설명을 담당합니다.** 이 저장소에는 독립 API까지 구현되어 있으며 실제 서비스 백엔드와 알림 전송 시스템 연결은 별도입니다.

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

`http://127.0.0.1:8000/healthz`에서 상태를, `/docs`에서 요청·응답 스키마를 확인합니다. 위 셸을 유지한 채 다른 터미널을 사용한다면 같은 개인 테스트 토큰을 안전하게 전달해야 합니다. 인증 헤더는 `Authorization: Bearer <테스트 토큰>`입니다. 토큰을 문서나 커밋에 복사하지 않습니다.

모델 연결을 생략하면 FDT 계산과 템플릿 설명으로 실행합니다. 실제 LLM을 사용하려면 [운영 설정](docs/operations.md)의 추론 서버를 연결합니다. HTTP 200만으로 모델이 답했다고 판단하지 말고 응답의 설명 출처와 대체 사유를 함께 확인합니다.

## 호출 순서

1. [`examples/bootstrap.json`](examples/bootstrap.json)을 `POST /v1/twin`으로 보내 초기 원장과 잔액을 저장합니다.
2. [`examples/payment.json`](examples/payment.json)을 `POST /v1/events`로 보내 거래를 반영합니다. `expected_revision`에는 조회한 현재 버전을 사용합니다.
3. 코칭 검토는 `POST /v1/coaching/reviews`, 대화 시작은 `POST /v1/sessions`, 질문은 `POST /v1/sessions/{session_id}/messages`를 사용합니다.
4. `GET /v1/notifications`로 알림 대기 항목을 읽고 실제 전달 후 `POST /v1/notifications/{event_id}/ack`로 확인합니다.

기존 KeyFin 차트는 `POST /v1/charts/budget-forecast`로 생성합니다. 거래를 요청에 담거나 저장된 Twin을 사용할 수 있으며, FDT 계산과 GPU 설명 추론을 거친 차트 JSON 및 원본 계산 근거를 반환합니다. [차트 연결 안내](docs/charts.md)에 요청 예시·HTML 조회·기간 및 금액 기준을 정리했습니다.

예시는 고정된 합성 날짜를 사용합니다. 이벤트 날짜와 분석 기준일을 임의로 섞지 않습니다. 최신 요청 필드와 응답 형식은 실행 중인 `/docs` 및 [`schemas.py`](src/coaching_service/schemas.py)가 기준입니다.

## 코드와 문서 찾기

| 경로 | 역할 |
| --- | --- |
| `src/coaching_service/api.py`, `routes.py` | 인증된 HTTP 경계 |
| `store.py`, `repository.py`, `events.py` | SQLite 저장·이벤트 반영·재시도 처리 |
| `engine.py`, `periods.py` | FDT 호출과 기준일·종료일 계산 |
| `coaching.py`, `dialogue.py`, `payments.py` | 코칭 발생·대화·결제 흐름 |
| `llm.py`, `evidence_projection.py`, `token_budget.py` | 모델 호출·근거 선택·실제 토큰 한도 검사 |
| `admission.py`, `rendering.py` | 모델 결과 검사와 설명 대체 |
| `chart_routes.py`, `charts.py`, `chart_contract.py`, `chart_projection.py`, `chart_rendering.py` | 고정 차트 JSON 변환, 생성·저장·HTML 조회 |
| `vendor/fdt/`, `ENGINE_MANIFEST.json` | 고정 엔진 소스와 무결성 목록 |
| `vendor/keyfin_chart/`, `CHART_MANIFEST.json` | 원래 차트 실행 자산 6개와 무결성 목록 |
| `scripts/gpu_worker.py` | 별도 추론 프로세스 실행 진입점 |
| `tests/`, `tests/forecast/` | 서비스·예측 평가기의 테스트 코드와 합성 테스트 입력 |
| `benchmarks/` | 코칭·소비 예측 성능 실험을 실행하는 코드와 고정 시나리오 입력 |
| `artifacts/` | 실행해서 만들어진 로그·결과·예측값·빌드 패키지; Git 업로드 제외 |

[구조와 기간 계약](docs/architecture.md), [검증 결과](docs/validation.md), [운영 설정](docs/operations.md)을 함께 참고합니다. `benchmarks/`는 API의 런타임 의존성이 아닙니다.

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
