# 기간별 소비 예측 평가

이 평가기는 기준일까지의 소비 이력으로 미래 봉투별 소비 합계를 예측하고 이후 SEED 원장 합계와 비교합니다. LLM의 질문 선택 점수를 측정하지 않습니다. 결과와 해석은 [검증 보고서](../../docs/validation.md)에 있습니다.

## 고정 프로토콜

2026-09-10 R7 실행 전에 정한 조건을 재현합니다. 기준 제품은 `be265a4e2c80d1bfd80de5f68c0cf5bdfb045fdb`, FDT는 `307de59c9d1fde01774388257da27730754e5118`입니다. 디렉터리를 정리하면서 실행 경로는 바뀌었으며 기존 점수·원시 기록은 덮어쓰지 않습니다.

- SEED 원장 4명, 사용자당 7개 소비 봉투를 사용합니다. `consumer_001.csv`~`consumer_004.csv`는 입력 디렉터리에 별도로 둡니다.
- 추가 학습은 6월 30일까지입니다. 사용자 하나를 제외하는 4개 fold마다 다른 3명의 21개 시계열만 학습합니다. 제외 사용자 이력은 해당 사용자의 추론 입력으로만 허용합니다.
- 7월 1·8·15·22일 기준 사례 중 미래 구간이 7월 안에 끝나는 336개를 개발에 씁니다. 선택과 보정 역시 해당 fold의 제외 사용자를 빼고 수행합니다.
- 8월의 같은 기준일에서 관측된 미래 구간이 완성된 336개를 평가합니다. 미래 7일 112개, 목표일까지 14일 84개, 30일 28개, 월말 112개입니다. 중복 날짜와 같은 사용자가 있으므로 336개의 독립 표본은 아닙니다.
- 기준일은 관측 마감이며 미래는 다음 날부터입니다. 충분한 90일 미래 관측은 없어 90일 오차를 평가하지 않습니다.
- 미래 정답은 원시 거래를 별도로 합산합니다. FDT 예측값이나 LLM 답변을 정답으로 사용하지 않습니다. 다만 거래 분류와 날짜 계약에 제품 규칙을 공유하므로 독립적인 금융 원장 감사는 아닙니다.

## 후보와 선택

11개 후보는 FDT(400 paths, seed 42), 전체 일평균, 최근 28일 평균, 요일·전체 평균 혼합, Chronos-2 기본/기존 합성 학습 모델의 일별·누적 예측, TimesFM 2.5 누적 예측, Chronos-2 추가 학습 두 조건입니다.

추가 학습은 full fine-tuning, batch 32, seed 712, context 64, prediction length 7, min past 7입니다. `64 steps / 1e-6`, `128 steps / 3e-6`을 4개 사용자 제외 fold마다 새 기본 체크포인트에서 시작해 총 8회 학습합니다. Chronos 추론은 context 128, horizon 30, batch 64, `cross_learning=False`입니다.

일별 예측 평균 합계는 점 추정만 사용합니다. 누적 예측은 종료일 누적 분위수에서 관측 누적액을 빼고 음수를 0으로 제한하며 교차 분위수를 정렬합니다. 일별 분위수를 단순 합산해 기간 합계 분위수로 사용하지 않습니다. 현재 대상은 예산에 포함되는 확정 소비로, 환불을 포함한 순현금흐름 예측과 다릅니다.

각 fold는 다른 사용자의 7월 WAPE가 FDT와 전체 평균보다 작거나 같은 후보 중 WAPE 최소를 고릅니다. 동률은 보정 전 WIS, 이름 순입니다. 8월 점수를 보고 다시 선택하지 않습니다. 선택된 후보와 보정 반경은 `selection_lock.json`으로 기록합니다.

개발 실제 소비 합계가 0이면 WAPE는 정의되지 않아 `null`로 유지하고, **후보 선택에만 MAE**를 사용합니다. 이 경우에도 FDT와 전체 평균의 오차 상한을 모두 지킵니다. 빈 사례와 0원 사례는 다릅니다.

보정은 `max(점 예측, 과거 일평균 × 미래 일수, 1000원)`으로 정규화한 구간 초과 오차를 사용합니다. 기간별 `ceil((n+1)×0.8)`번째 개발 오차로 구간을 확장합니다. 후보 선택과 보정에 같은 개발 자료를 사용하며 날짜·사용자가 의존하므로 80% 포함률을 이론적으로 보장하지 않습니다.

다음 자료에 전달할 개선 후보의 사전 조건은 FDT 대비 상대 WAPE 10% 이상 감소, 전체 평균보다 낮은 WAPE, 보정 WIS 개선, 각 기간 WAPE 악화 5% 이하입니다. 이는 이 실험의 판정선이며 업계 기준이나 운영 SLA가 아닙니다. 통과하더라도 제품 모델을 자동 변경하지 않습니다.

## 실행 순서

서비스 디렉터리에서 실행합니다. 출력 디렉터리는 새 경로여야 합니다.

```text
python -m benchmarks.forecast.prepare /private/seed-directory /private/prepared-run
python -m benchmarks.forecast.worker /private/run-config.json
python -m benchmarks.forecast.bundle /private/neural-results /private/result-bundle.json
python -m benchmarks.forecast.evaluate /private/prepared-run /private/result-bundle.json /private/analysis-run
```

`prepare`의 `model_inputs.json`만 모델 실행 환경으로 전달합니다. `truth.json`, `baselines.json`과 원시 원장은 평가 환경에 남깁니다. `worker`에는 [운영 설정](../../docs/operations.md)의 단일 할당 장치 환경 변수와 별도 예측 의존성이 필요합니다. 실행 설정은 다음 필드이며 실제 경로는 커밋하지 않습니다.

```json
{
  "inputs": "/private/model_inputs.json",
  "output": "/private/neural-results",
  "chronos_checkpoint": "/private/chronos-base",
  "timesfm_checkpoint": "/private/timesfm-base",
  "previous_checkpoint": "/private/previous-synthetic-checkpoint"
}
```

기존 합성 학습 체크포인트도 있어야 11개 비교 전체를 재현할 수 있습니다. 없을 때 기본 모델로 대체하고 같은 실험이라고 보고하지 않습니다. 실행 기록은 입력·소스·가중치 SHA-256, 패키지 버전, 학습 단계·시간과 예측을 남깁니다. `bundle`은 완료된 결과 JSON만 묶고 체크포인트와 프로세스 로그를 제외합니다.

현재 `bundle` 형식은 v2입니다. 원본 JSON의 UTF-8 바이트를 `raw_files`에 보존하고 기존 `sha256`과 대조합니다. 파싱된 `files`와의 값·키 집합 일치, 입력 파일 해시, 필수 모델·fold·case의 모든 예측, 중복 정답을 검사한 뒤에만 점수를 기록합니다. 신경망 예측 없이 기준선만 남은 결과는 완료로 처리하지 않습니다. 해시 일치는 보관·전달 무결성 검사이며 정답의 진실성이나 작성자의 독립성을 증명하지 않습니다.

v1 아카이브는 원문 바이트를 보존하지 않아 새 평가기가 거절합니다. **기존 worker 결과 디렉터리에서 `bundle` 명령을 다시 실행**해 새 파일로 내보내야 합니다. 원본이 없다면 기존 파싱 JSON을 다시 직렬화해 원문이라고 주장하지 않습니다. 이 형식 변경은 추가 모델 학습을 요구하지 않습니다.

확인한 예측 환경은 PyTorch 2.7.1, Transformers 5.16.1, Chronos Forecasting 2.3.1, TimesFM 2.0.2, NumPy 2.5.3입니다. 체크포인트 버전은 Chronos-2 `29ec3766d36d6f73f0696f85560a422f50e8498c`, TimesFM 2.5 `1d952420fba87f3c6dee4f240de0f1a0fbc790e3`입니다. API 참고는 [Amazon Chronos](https://github.com/amazon-science/chronos-forecasting), [Google TimesFM](https://github.com/google-research/timesfm) 공식 코드입니다.
