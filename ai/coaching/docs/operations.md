# 운영 설정

API와 모델 추론 프로세스는 분리합니다. API는 `uv.lock`으로 설치하고, Linux 추론 환경은 [`requirements-inference.txt`](../scripts/requirements-inference.txt)의 패키지와 CUDA가 작동하는 PyTorch를 준비합니다. 검증에 사용한 PyTorch 빌드는 `2.7.1+cu128`입니다. 드라이버·CUDA 호환성은 배치할 환경에서 확인해야 합니다.

## 추론 서버

체크포인트는 로컬에 준비합니다. 워커는 온라인에서 임의 최신 모델을 내려받지 않으며 `config.json` 해시와 등록된 모델·양자화 조합을 검사합니다. 현재 지원하는 두 조합은 다음과 같습니다.

| 워커 태그 | 모델 | 방식 | 확인한 revision |
| --- | --- | --- | --- |
| `base8` | Qwen/Qwen3-8B | BF16 | `b968826d9c46dd6066d109eabc6255188de91218` |
| `latest27_nf4` | Qwen/Qwen3.8-27B | NF4 | `1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0` |

개인 모델 등록 파일에는 아래 형식으로 실제 경로와 해시를 넣습니다. `revision`은 확인한 스냅샷의 40자리 commit, `config_sha256`은 그 경로의 `config.json`을 직접 계산한 64자리 해시입니다. 이 검사는 전체 가중치의 공급망 검증을 대신하지 않습니다.

```text
{"models":[{"tag":"latest27_nf4","model_id":"Qwen/Qwen3.8-27B","path":"/private/checkpoint","revision":"<40자리 commit>","config_sha256":"<64자리 sha256>","quantization":"nf4"}]}
```

실행 전에 다음 환경 변수를 설정합니다. 값은 서버별 개인 설정으로 관리합니다.

| 변수 | 값 |
| --- | --- |
| `CUDA_VISIBLE_DEVICES` | 사전에 할당받고 사용 상태를 확인한 단일 장치 식별자 |
| `COACH_GPU_ALLOWED_DEVICES` | 실행자가 사용 권한을 확인한 장치 허용 목록 |
| `COACH_GPU_WORKSPACE` | 실행자 소유의 절대 디렉터리 |
| `COACH_GPU_MODEL_REGISTRY` | 개인 모델 등록 JSON 파일의 절대 경로 |
| `COACH_GPU_MODEL` | `base8` 또는 `latest27_nf4` |
| `COACH_GPU_PORT` | loopback 수신 포트, 기본 `18743` |
| `COACH_GPU_BATCH_SIZE` | 기본 `0`(기존 순차 처리). `1`~`4`는 토큰 검사 분리·제한된 온라인 배치를 명시적으로 활성화 |

작업 디렉터리에 충분히 긴 무작위 `worker.token`을 만들고 파일 권한을 `0600`으로 설정합니다. 토큰과 작업 디렉터리 소유자는 실행자와 같아야 합니다. 단일 장치 선택이 없거나 허용 목록과 다르면 시작을 거부합니다. 이 검사는 관리자의 스케줄러나 권한 통제를 대신하지 않습니다.

설정한 환경을 사용하는 Python으로 서비스 디렉터리에서 `python scripts/gpu_worker.py`를 실행합니다. `GPU_WORKER_MODEL_READY` 이후 `GET /health`로 모델·revision·한도를 확인합니다. 인증된 `POST /v1/tokenize`와 `POST /v1/chat/completions`를 제공합니다. 기본값 `0`은 기존처럼 생성 1개·대기 포함 요청 2개입니다.

배치를 켜도 GPU `generate` 호출은 한 번에 하나만 실행합니다. 같은 출력 토큰 상한의 FIFO 요청을 최대 8ms 동안 모으고, 가장 긴 입력과 출력 상한의 합에 배치 크기를 곱한 값이 16,384토큰 이하여야 합칩니다. 배치 모드의 대기 포함 요청 상한은 16개이며 포화 시 429를 반환합니다. CPU 토큰 검사는 별도 tokenizer 복사본으로 처리합니다. 입력 8,192토큰·출력 1,536토큰 상한과 프롬프트 지문 검증은 그대로입니다.

연결이 끊긴 요청은 대기열에서 취소합니다. 이미 시작한 CUDA 호출은 강제로 중단하지 않고 결과를 버리므로, 실행 중인 다른 요청을 손상시키지 않습니다. 생성 실패는 해당 배치에 503으로 반환하고 다음 배치를 처리합니다. 큰 배치가 항상 빠르지는 않으므로 [실측 비교와 채택 판단](concurrency-improvement-r18.md)을 읽고 서비스의 실제 부하로 다시 확인합니다.

## API에서 모델 연결

API 실행 환경의 `COACHING_MODEL`에 다음 JSON을 지정합니다. 주소는 같은 호스트의 loopback 또는 인증된 터널의 loopback 끝점이어야 합니다. `<worker token>`은 실제 개인 토큰을 안전하게 주입합니다.

```text
{"endpoint_url":"http://127.0.0.1:18743","token":"<worker token>","model":"latest27_nf4","token_preflight":true}
```

`COACHING_CLIENTS`는 서비스 이용 주체별 토큰 목록이고 모델 토큰과 다릅니다. `backend`·`user`·`notification` 역할과 사용자 ID를 구분합니다. 데이터베이스는 `COACHING_DATABASE`로 지정합니다. `.env`는 자동 로드하지 않으므로 환경 변수나 실행 도구의 명시적인 env 파일 기능을 사용합니다.

## 상태와 장애 확인

API `/healthz`의 `model_configured`는 설정 유무입니다. 모델 추론 성공을 보장하지 않습니다. 워커 `/health`도 프로세스·모델 적재 확인이므로 실제 요청은 [HTTP 평가](../benchmarks/coaching/e2e/README.md)로 확인합니다.

실제 모델 호출의 `wording.source`, `fallback_reason`, 토큰 측정 및 응답 시간을 함께 봅니다. 413은 입력/본문 제한, 409는 측정 후 프롬프트 변경, 429는 대기열 포화입니다. 대체 문구가 반환됐다고 수치 계산까지 실패한 것으로 해석하지 않습니다.

SQLite 파일, 토큰, 원장과 원시 응답은 `state/`, `artifacts/` 또는 저장소 밖에서 보관합니다. 재실행마다 새 실험 출력 경로를 사용하고 학습 가중치와 서버 로그를 커밋하지 않습니다. 알림 API는 전달 대기와 확인을 제공하며 실제 푸시 전송, 운영 백업, 사용자 동의 및 실제 고객 대상 평가는 서비스 연결 단계에서 검증해야 합니다.
