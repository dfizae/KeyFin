# GAME `items` 시드 요청 (2026-09-18, 2026-09-21 갱신)

받는 사람: 게임 도메인 담당(윤현준) · 보내는 사람: 프론트
관련: `docs/api-contract.md` GAME 절 · FR-GAM-05(상점) · 방 씬 3단계

> **2026-09-21 현황.** 기본 가구는 백엔드 V15(`5b143f9`, 냉장고·소파·TV 지급·설치·해제 불가)로 들어왔습니다 — 아래 §2·§3 의 기본 가구 부분은 V15 가 대신합니다.
> 남은 요청은 **§4 판매 개시(V21)**와 **§8 좌표 검증·기본 가구 좌표** 두 가지입니다(§7 가구 행 요청은 V20 으로 종결). 옷 3종·가구 56종은 V19·V20 으로 행이 들어왔으나 **전부 비활성이라 상점에 안 나옵니다 — §4 가 판매 개시 요청**입니다(오후 갱신).

## 0. 왜 필요한가

상점 API(`GET /shop` · `POST /shop/purchase`)가 2026-09-18 배포됐지만 **`items` 테이블에 기준 데이터가 없어** 다음이 전부 막혀 있습니다.

1. `GET /shop` 이 빈 배열 → 상점 화면을 만들어도 볼 게 없다
2. 아무도 가구를 살 수 없어 `user_furnitures` 가 계속 비어 있다
3. 그래서 `GET /room` 의 `furnitures` 도 빈 배열이고, **방 배치 저장(`PATCH /furnitures/{userFurnitureId}`)이 한 건도 동작하지 않는다** — 앱은 로컬 기본 배치 폴백을 그려 주기만 해서, 사용자가 가구를 옮기고 "완료"를 눌러도 새로고침하면 원위치된다(2026-09-18 재현·확인)

## 1. 확인한 사실 (추측 아님)

- 마이그레이션 V1~V14 어디에도 `items` INSERT 가 없다. `INSERT` 가 있는 건 V1(envelopes·subcategories)과 V7·V14(merchants)뿐이다.
- `user_furnitures` 행을 만드는 코드는 **상점 구매(`UserFurniture.acquire`)뿐**이다. 가입 시 지급 경로가 없다(`AuthService.signup` 은 `UserSettings` 만 만든다).
- `GET /shop` 은 `is_active = true` 인 것만 돌려주고(`ItemRepository.findShopItems`), 구매도 active 인 것만 된다.
- 스키마 제약(V3): `item_category='FURNITURE'` 면 `slot_type IN ('WALL','FLOOR')`.

## 2. 요청 A — 가구 7종 `items` 행

| id | item_category | slot_type | name | asset_key | price | theme_code | is_active |
|---|---|---|---|---|---|---|---|
| 1 | FURNITURE | FLOOR | 소파 | `sofa_default` | 0 | NULL | **FALSE** |
| 2 | FURNITURE | FLOOR | 책상 | `desk_default` | 0 | NULL | **FALSE** |
| 3 | FURNITURE | FLOOR | 냉장고 | `fridge_default` | 0 | NULL | **FALSE** |
| 4 | FURNITURE | FLOOR | 화분 | `plant_default` | 0 | NULL | **FALSE** |
| 5 | FURNITURE | WALL | 예산 보드 | `board_default` | 0 | NULL | **FALSE** |
| 6 | FURNITURE | WALL | 출금 캘린더 | `calendar_default` | 0 | NULL | **FALSE** |
| 7 | FURNITURE | FLOOR | 테이블 | `table_default` | 20 | NULL | TRUE |

- **`is_active = FALSE` 인 6개는 "가입 시 기본 지급" 용**입니다(요청 B). 상점에 노출되면 전부 "이미 보유"로만 보여 상점이 무의미해지므로 비노출로 둡니다.
- 판매 상품은 지금 테이블 1종뿐입니다. 상점을 채울 추가 가구 스프라이트는 프론트에서 만들어 `asset_key` 와 함께 다시 요청드리겠습니다(소파·책상·냉장고·화분도 같은 방식으로 만든 에셋입니다).
- **`asset_key` 규칙: `<물건>_<변형>`** (Swagger 예시 `sofa_default`·`sofa_blue` 를 따랐습니다). 앱이 이 문자열로 스프라이트를 찾기 때문에(`frontend/features/room/catalog.ts`) **값이 다르면 그 가구는 화면에 그려지지 않습니다.** 다른 이름을 쓰실 거라면 확정된 목록만 알려 주시면 앱을 맞추겠습니다.

## 3. 요청 B — 가입 시 기본 가구 지급 + 기존 사용자 백필

- **신규 가입**: 위 id 1~6 을 `UserFurniture.acquire` 후 아래 좌표로 `place` 해 주세요.
- **기존 사용자**: 마이그레이션으로 현재 사용자 전원에게 같은 6개를 INSERT 해 주세요. **지금 팀 시연 계정이 전부 빈 방이라 이 백필이 없으면 시연에서 달라지는 게 없습니다.**

좌표는 **327×586 씬 기준**이고 `BigDecimal(8,3)` 입니다. **아래 값 그대로 넣으면 앱이 보여 주는 방과 픽셀 단위로 같습니다**(앱의 기본 배치에서 뽑은 값).

> ⚠️ 2026-09-18 갱신: 홈이 화면 전체를 방으로 채우게 되면서 방 그림을 세로로 긴 것(327:586)으로 바꿨습니다. **아래 좌표는 그 새 그림 기준**이고, 이전에 드린 327:404 기준 좌표는 폐기입니다. 씬 크기는 앱이 정하는 값이라 서버는 이 숫자를 그대로 저장만 하면 됩니다.

| asset_key | placement_status | placement_direction | position_x | position_y | layer |
|---|---|---|---|---|---|
| `desk_default` | FLOOR | FRONT_RIGHT | 202.688 | 340.938 | 0 |
| `fridge_default` | FLOOR | FRONT_RIGHT | 120.750 | 333.375 | 0 |
| `plant_default` | FLOOR | FRONT_RIGHT | 79.167 | 404.875 | 0 |
| `sofa_default` | FLOOR | FRONT_RIGHT | 198.125 | 443.250 | 0 |
| `board_default` | RIGHT_WALL | FRONT_RIGHT | 245.500 | 222.000 | 0 |
| `calendar_default` | RIGHT_WALL | FRONT_RIGHT | 299.833 | 250.333 | 0 |

- 테이블(id 7)은 기본 배치에 없습니다. 상점에서 사면 **미배치 상태**로 보유되고 사용자가 방 꾸미기에서 놓습니다.
- 벽걸이 2개(보드·캘린더)를 기본 지급에 넣은 이유: 홈에서 **봉투 잔액 팝오버와 출금 일정 팝오버의 진입점**이라, 상점에서 사야 하면 신규 사용자가 핵심 기능을 쓸 수 없습니다.

## 4. 요청 C — 의상 세트 3종·새 가구 56종의 **판매 개시(`is_active = TRUE`)** (2026-09-21 오후 갱신)

> **행은 들어왔습니다.** 백엔드 V19(의상 3종)·V20(가구 56종)이 develop `66011de` 에 머지됐고(`43da5ca feat(catalog): 가구·의상 59종 Flyway 등록`), 앱은 그 `asset_key` 에 맞췄습니다.
> **남은 것은 하나입니다 — 59종이 전부 `is_active = FALSE` 라 상점에 한 개도 나오지 않습니다.**

### 왜 안 보이나 (확인한 사실)

- V19·V20 모두 `INSERT ... is_active = FALSE` 입니다. V19 주석: *"sales remain disabled until the app supports these assets."*
- `GET /shop` 은 `ItemRepository.findShopItems` 의 `where i.active = true and i.defaultFurnitureType is null` 만 돌려줍니다. 구매도 active 인 것만 됩니다.
- develop 어디에도 이 59종을 켜는 마이그레이션·코드가 없습니다(`V20` 이 마지막).
- 그래서 앱에서 '세트'를 고르면 **"이 종류에 파는 상품이 없어요"** 가 뜹니다(2026-09-21 실서버 확인).

### 앱은 준비됐습니다

V19 주석의 조건("앱이 이 에셋을 지원할 때까지")이 충족됐습니다.

| 서버 `asset_key` | name | price | 앱 에셋 |
|---|---|---|---|
| `outfit_epic_mage` | 에픽 마법사 의상 세트 | 500 | `assets/sprites/outfits/outfit_epic_mage/{shop,standing,sitting}.png` |
| `outfit_legendary_paladin` | 레전더리 성기사 의상 세트 | 1000 | 〃 `outfit_legendary_paladin/` |
| `outfit_mythic_dragon` | 신화 용염 의상 세트 | 2000 | 〃 `outfit_mythic_dragon/` |

- 의상 3종: 키·이름·가격 모두 V19 와 같습니다(`frontend/features/room/outfits.ts`). 상점 타일·옷장 카드·방 씬(서 있기·소파에 앉기)에 그림이 붙습니다.
- 가구 56종: **V20 의 `asset_key` 56개가 앱 스프라이트 키와 전부 일치합니다**(서버에만 있는 키 0개, 2026-09-21 대조 — `frontend/features/room/furniture-sprites.ts`).
- 옷은 세트 한 벌이라 앱은 부위 탭 없이 '세트'로만 보여 줍니다. `slot_type = 'UPPER_BODY'` 로 넣어 주신 덕분에 "같은 부위의 기존 아이템을 자동으로 벗기는" 동작으로 **세트는 언제나 한 벌만 입은 상태**가 됩니다.

### 요청

59종을 판매 상태로 바꾸는 마이그레이션(V21)을 부탁드립니다. V19·V20 은 이미 적용돼 고칠 수 없으니 새 버전이어야 합니다.

```sql
-- V21__activate_outfit_and_furniture_catalog.sql (제안). V19·V20 의 59종만 켠다.
UPDATE items SET is_active = TRUE
WHERE default_furniture_type IS NULL
  AND is_active = FALSE
  AND asset_key IN (
    'outfit_epic_mage', 'outfit_legendary_paladin', 'outfit_mythic_dragon',
    'desk_original', 'coffee_table_original', 'dining_table_original', 'dining_chair_original',
    'bed_original', 'nightstand_original', 'bookcase_original', 'wardrobe_original',
    'sofa_black', 'desk_black', 'coffee_table_black', 'refrigerator_black',
    'dining_table_black', 'dining_chair_black', 'bed_black', 'nightstand_black',
    'bookcase_black', 'wardrobe_black', 'sofa_pink', 'desk_pink',
    'coffee_table_pink', 'refrigerator_pink', 'dining_table_pink', 'dining_chair_pink',
    'bed_pink', 'nightstand_pink', 'bookcase_pink', 'wardrobe_pink',
    'sofa_sunset', 'desk_sunset', 'coffee_table_sunset', 'refrigerator_sunset',
    'dining_table_sunset', 'dining_chair_sunset', 'bed_sunset', 'nightstand_sunset',
    'bookcase_sunset', 'wardrobe_sunset', 'plant_monstera_terracotta', 'plant_sansevieria_ivory',
    'plant_rubber_brass', 'plant_palm_blue_wave', 'decor_abstract_frame', 'decor_botanical_frame',
    'decor_wave_poster', 'decor_arch_poster', 'decor_round_wall_clock', 'decor_arc_floor_lamp',
    'decor_oval_rug', 'decor_checker_rug', 'decor_round_mirror', 'decor_wall_shelf',
    'window_sky_clouds', 'tv_set_black', 'tv_set_pink', 'tv_set_sunset'
  );
```

- 기본 가구(`default_furniture_type` 이 있는 냉장고·소파·TV)는 `chk_default_furniture` 가 `is_active = FALSE` 를 강제하므로 건드리지 않습니다.
- 일부만 먼저 여시려면 의상 3종부터 부탁드립니다 — 시연에서 "사서 입으면 방 안 캐릭터가 갈아입는다"가 가장 눈에 띕니다.

### 가격 참고

코인 수입이 아직 출석 10코인/일뿐이라(§5) 에픽 500 도 50일치입니다. 시연 계정에 코인을 넉넉히 넣어 두시거나 `CONFIRM_ALL`·`WEEKLY` 지급이 붙은 뒤에 여는 편이 자연스럽습니다. 가격 자체는 백엔드 결정이라 앱은 서버 값을 그대로 보여 줍니다.

## 5. 가격 근거

지금 코인 수입은 **출석 10코인/일** 하나뿐입니다(`FinCoinServiceImpl.ATTENDANCE_REWARD = 10`. `CONFIRM_ALL`·`WEEKLY`·`MONTHLY` 는 enum 에만 있고 지급 코드가 없습니다). 시연 기간이면 20~50코인 수준이라 판매가를 그 범위에 맞췄습니다. 코인 지급이 늘어나면 가격도 같이 올리면 됩니다.

## 6. 시드가 오면 프론트가 맞출 것

- `catalog.ts` 의 `assetKey` 추정값을 확정값으로 교체
- 기본 배치 폴백(`DEFAULT_LAYOUT`) 제거 — 서버가 기본 가구를 주면 필요 없습니다(2026-09-21: V15 로 기본 가구 3종이 온다. 벽 보드·캘린더는 앱이 채운다)
- 상점 화면 착수(2026-09-20 완료)

## 7. 요청 D — 새 가구 판매 행 → **V20 으로 종결** (2026-09-21 오후)

오전에 70종 행을 요청드렸는데 **V20 이 56종을 넣어 주셔서 이 요청은 끝났습니다.** 남은 일은 §4(판매 개시)뿐입니다.

- **앱을 V20 에 맞췄습니다.** `asset_key` 56개 전부 일치하고, 이름·가격도 V20 값으로 바꿨습니다(가구 500 · 벽 장식 300 · 식물·러그·조명 200). 오전에 드린 분류별 제안 가격(침대 200 등)은 폐기입니다.
- **나머지 14종은 요청을 철회합니다.** V20 이 뺀 탁상 소품 10종과 작은 화분 4종은 앞으로도 넣지 않기로 해서 앱에서도 그림·카탈로그를 지웠습니다(사용자 결정 2026-09-21). 서버에 추가하실 필요 없습니다.
  - `decor_books_bookend` · `decor_candle_tray` · `decor_donut_vase` · `decor_mantel_clock` · `decor_metal_bird` · `decor_metal_knot` · `decor_mini_frame` · `decor_mushroom_lamp` · `decor_orbit_sculpture` · `decor_wave_vase`
  - `plant_bonsai_slate` · `plant_cactus_concrete` · `plant_pothos_hanging` · `plant_succulent_blush`
- 기본 가구와 똑같은 그림인 `sofa_original` · `refrigerator_original` · `tv_set_original` 은 V20 에도 없고 앱도 팔지 않습니다. 앱은 이 그림을 기본 가구(`sofa_default` 등)를 그리는 데만 씁니다.
- 앱 쪽 계약 사본은 `frontend/api/mocks/shop-seed.ts` 입니다(V19·V20 을 그대로 옮긴 값). 시드를 바꾸시면 알려 주세요 — 목·카탈로그가 이 값과 한 행씩 같은지 테스트가 확인합니다.
- 분류(침대·소파 …)는 서버에 필요 없습니다. 앱이 `asset_key` 로 정합니다.

## 8. 요청 E — 좌표 검증 상한과 기본 가구 좌표 (2026-09-21)

**① `PATCH /furnitures/{id}` 의 `positionY` 상한이 404 입니다(`@DecimalMax("404")`, `positionX` 는 327).** 앱의 방 그림은 2026-09-18 부터 **327×586** 이라(§3 경고 참고) 바닥 대부분(y 286~586)이 404 를 넘습니다. 그 자리에 가구를 놓고 저장하면 **400 COMMON_001** 이 납니다. `positionY` 상한을 **586** 으로 올려 주세요(Swagger 설명의 "327×404 씬 기준" 문구도 함께). 앱은 서버 계약을 우회하지 않고 그대로 보냅니다.

> **2026-09-21 저녁 — 실서버에서 재현됐습니다.** 방 꾸미기에서 가구를 옮기고 완료를 누르면 `PATCH /api/v1/furnitures/3` 이 **400** 으로 떨어집니다.
> - **DTO 만 고치면 안 됩니다. DB 제약도 같은 값입니다** — V3 의 `chk_uf_position_y CHECK (position_y IS NULL OR position_y BETWEEN 0 AND 404)`. `@DecimalMax("586")` 만 올리면 400 대신 저장 단계에서 제약 위반(500)이 납니다. **V21+ 마이그레이션으로 제약을 0~586 으로 다시 걸어 주셔야** 합니다(`position_x` 는 0~327 그대로).
> - 영향 범위(앱에서 계산): 가구를 놓을 수 있는 바닥 칸 중 **y ≤ 404 라 저장되는 칸은 약 30%**(소파 72칸 중 22, 냉장고 96칸 중 29, 침대 59칸 중 20)이고 전부 방 안쪽 벽 가까이입니다. 앱 기본 배치의 소파(y 443.25)부터 걸립니다.
> - 앱은 좌표를 소수 3자리로 반올림하고 `layer` 는 정수, 해제 때는 `placed` 만 보내므로 DTO 의 다른 검사(`@Digits`·일관성·layer)에는 걸리지 않습니다.

**② V15 기본 가구 초기 좌표가 옛 327×404 씬 값입니다.** 앱은 놓을 수 없는 자리의 가구를 가장 가까운 빈 칸으로 당겨 그리지만(그래서 지금도 보이기는 합니다), 사용자가 방 꾸미기에서 옮기기 전까지 서버 값은 벽 높이에 떠 있습니다. 새 방 기준 값은 아래와 같습니다(앱 기본 배치에서 뽑은 값, 방향은 V15 그대로 FRONT_RIGHT).

| default_furniture_type | asset_key | position_x | position_y |
|---|---|---|---|
| FRIDGE | `fridge_default` | 120.750 | 333.375 |
| SOFA | `sofa_default` | 198.125 | 443.250 |
| TV | `tv_default` | 190.625 | 334.688 |

- 소파 y(443.25)는 ①의 상한을 올려야 저장됩니다.
- 앱은 기본 가구에 새 그림(오리지널 색)을 쓰고, TV 도 이제 그립니다(2026-09-21).
