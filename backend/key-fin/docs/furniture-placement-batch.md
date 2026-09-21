# 방 가구 일괄 저장

## API와 프론트 연동

`PUT /api/v1/furnitures/placements` (Access Token 필요)

완료 버튼에서 **최종 설치 가구 전체**를 한 번 보낸다. 드래그 중에는 앱의 편집 사본만 변경한다.
변경된 가구만 보내면 누락된 가구가 모두 보관 상태로 바뀐다. 취소할 때는 요청하지 않는다.

```json
{
  "placements": [
    {"userFurnitureId":101,"placementStatus":"FLOOR","placementDirection":"FRONT_RIGHT","positionX":60,"positionY":430,"layer":0},
    {"userFurnitureId":102,"placementStatus":"FLOOR","placementDirection":"FRONT_LEFT","positionX":160,"positionY":500,"layer":0},
    {"userFurnitureId":103,"placementStatus":"FLOOR","placementDirection":"FRONT_RIGHT","positionX":260,"positionY":586,"layer":0}
  ]
}
```

예시의 ID는 각 사용자가 보유한 냉장고·소파·TV의 `userFurnitureId`로 대체한다. 추가 설치할 일반 가구도 같은 배열에 포함한다.
상품 ID(`itemId`)나 에셋 키를 보내지 않는다. 가구 종류와 딱지 상태는 서버가 결정한다.

- 배열 필수, 최대 100개, 중복 ID 금지. 빈 배열은 필수 가구 누락이다.
- ID는 양수이고 본인 소유여야 한다. 설치 면·방향·좌표는 필수다.
- X는 0~327, Y는 0~586이며 소수점 최대 3자리다. `layer`는 음수도 허용하는 정수이며 생략·null이면 0이다.
- 색상과 관계없이 `furnitureType`이 `FRIDGE`, `SOFA`, `TV`인 가구가 최종 배열에 각각 정확히 하나 있어야 한다.
- 설치 면은 상품의 FLOOR/WALL 구분과 일치해야 한다. 겹침·격자·면 내부 판정은 앱이 담당한다.
- 서버 보유 가구 ID가 없는 보드·캘린더 등 앱 전용 오브젝트는 제외한다.
- 앱에서 그림을 표시하지 못하는 서버 가구는 원본 응답의 배치를 유지하여 포함한다. 렌더링 가능한 가구 목록만으로 요청을 만들지 않는다.

성공 응답의 `data`는 `GET /api/v1/furnitures`와 같은 전체 보유 가구 배열이다. 미설치 가구도 포함하고 보유 가구 ID 오름차순으로 정렬한다.
성공하면 응답으로 보유 목록을 갱신하고 방 조회 캐시를 무효화한다. 실패하면 편집 사본을 유지한다.
서버는 모든 변경과 딱지 승계를 하나의 트랜잭션으로 처리하며 일부 가구만 저장하지 않는다.
동일 요청 재시도는 배치·딱지 상태를 중복 변경하지 않는다. 여러 기기의 요청은 사용자 잠금으로 순차 처리하고 마지막 유효한 저장을 반영한다.

| 오류 | 의미 |
|---|---|
| 400 COMMON_001 | 필수값, 개수 상한, 중복 ID, 좌표 등 입력 오류 |
| 400 COMMON_002 | JSON·enum 파싱 오류, 소수/문자열 layer 등 |
| 400 FURNITURE_002 | 상품과 설치 면 불일치 |
| 401 | Access Token 없음·유효하지 않음 |
| 404 USER_001 | 활성 사용자 없음 |
| 404 FURNITURE_001 | 미보유·타인 가구. 두 경우를 구별하지 않음 |
| 409 FURNITURE_004 | 소파·TV·냉장고 중 누락 또는 중복 |

## 교체와 딱지

`defaultFurnitureType`은 기본 지급 상품 식별값으로 유지한다. 새 `furnitureType`은 기본 지급 여부나 색상과 무관한 필수 가구 종류이며 일반 가구는 null이다.
보유 가구 및 방의 설치 가구 응답 모두에 두 필드가 포함된다.

`canUnplace`는 **단독 해제 가능 여부**다. 설치된 필수 가구는 false이지만 일괄 저장에서는 같은 종류의 다른 보유 가구로 교체할 수 있다.
편집 UI는 교체 과정의 임시 누락을 허용하고, 완료 시 종류별 하나가 선택되었는지 검사해야 한다.

교체 시 같은 종류의 기존 딱지가 새 가구로 옮겨진다. 보관된 이전 가구의 딱지는 사라지지만 딱지 제거로 계산하지 않는다.
한국 시간 기준 하루 제거 제한과 예산별 부착 이력은 그대로다. 새 예산의 딱지도 현재 설치된 필수 가구에 부착된다.
구매 가구가 설치되어 있으면 방 조회나 예산 동기화가 기본 지급 가구를 다시 설치하지 않는다.

기존 `PATCH /api/v1/furnitures/{userFurnitureId}`는 유지한다. 이동·일반 가구 설치/해제를 지원하되 변경 후 필수 가구가 각각 하나인지 검사한다.
설치된 필수 가구 단독 해제는 `409 FURNITURE_003`, 추가 중복 설치는 `409 FURNITURE_004`다. 교체는 PUT을 사용한다.

## 배포와 기존 데이터

V23은 `items.furniture_type`과 CHECK를 추가한다. V15의 기본 3종 및 V20의 블랙·핑크·선셋 소파/냉장고/TV 9종을 분류한다.
상품을 추가할 때 같은 종류의 새 상품에도 `furniture_type`을 명시해야 한다. 서버는 상품 이름이나 클라이언트 입력으로 종류를 추측하지 않는다.

이번 변경은 V23 하나만 추가하며, 기존 중복 설치나 잘못된 딱지 데이터가 없는 개발 DB를 전제로 한다.
보유 가구·배치·딱지를 정리하는 데이터 마이그레이션은 수행하지 않는다.
회원가입 시 기본 3종이 자동 지급·설치되며, 기존 계정의 누락된 기본 가구는 방 조회 시 지급·설치된다.
이미 같은 종류의 구매 가구가 설치되어 있으면 기본 상품의 보유만 보장하고 다시 설치하지 않는다.

배포 순서:

1. 구버전 서버의 쓰기를 중단한다. 구버전 서버는 기본 가구를 다시 설치하므로 신버전과 동시에 요청을 처리하지 않는다.
2. 새 서버에서 Flyway V23을 적용하고 모든 인스턴스를 새 버전으로 전환한다.
3. 방 조회·일괄 저장과 아래 진단 SQL을 점검한다. 미초기화 계정의 필수 가구 0개는 방 조회 후 다시 확인한다.

프론트가 일괄 API로 전환하기 전까지 구매 필수 가구의 추가 설치는 단건 API에서 거절된다.

### 종류별 설치 수 진단

```sql
SELECT u.id AS user_id, kinds.kind AS furniture_type, COUNT(uf.id) AS placed_count
FROM users u
CROSS JOIN (SELECT 'FRIDGE' AS kind UNION ALL SELECT 'SOFA' UNION ALL SELECT 'TV') kinds
LEFT JOIN (user_furnitures uf JOIN items i ON i.id = uf.item_id)
    ON uf.user_id = u.id AND i.furniture_type = kinds.kind AND uf.placement_status IS NOT NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, kinds.kind
HAVING COUNT(uf.id) <> 1;
```

### 보관 가구·일반 가구의 잘못된 딱지 진단

```sql
SELECT uf.id, uf.user_id, i.asset_key
FROM user_furnitures uf
JOIN users u ON u.id = uf.user_id
JOIN items i ON i.id = uf.item_id
WHERE u.deleted_at IS NULL AND uf.sticker_attached = TRUE
  AND (uf.placement_status IS NULL OR i.furniture_type IS NULL);
```
