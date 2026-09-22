import { api, isMocked } from "@/api/client";
import * as client from "@/api/client";
import { ApiError } from "@/api/error";
import { acquireFurnitureMock, furnitureListMock, placedFurnitureMock, resetFurnitureMocks, updateFurniturePlacementsMock } from "@/api/mocks/furniture";
import { updateFurniturePlacements } from "@/features/room/api/furniture.api";
import { storeAwayBlock, storedFurnitures, toPlacements, toUserFurniture, toUserFurnitures, type UserFurnitureDto } from "@/features/room/furniture";
import { buildPlacementsRequest, placementErrorMessage, validatePlacements } from "@/features/room/placements";
import { DEFAULT_LAYOUT } from "@/features/room/scene";
import { ContractMismatchError } from "@/lib/contract";

const owned = () => toUserFurnitures(furnitureListMock());
const draft = () => toPlacements(placedFurnitureMock());
const request = () => buildPlacementsRequest(draft(), owned());
const placedExtra = (id: number, assetKey = "unrendered_asset"): UserFurnitureDto => ({
  ...furnitureListMock()[0], userFurnitureId: id, itemId: id, assetKey, name: "추가 가구", furnitureType: null,
  defaultFurnitureType: null, canUnplace: true, stickerAttached: false, positionX: 123.123, positionY: 500.001,
  placementDirection: "FRONT_LEFT", layer: -3,
});

beforeEach(() => resetFurnitureMocks());
afterEach(() => jest.restoreAllMocks());

describe("최종 배치 요청", () => {
  it("그대로인 필수 가구까지 모두 포함하고 앱 전용 오브젝트는 제외한다", () => {
    const result = buildPlacementsRequest([...draft(), ...DEFAULT_LAYOUT.filter((item) => item.itemId === "board")], owned());
    expect(result.placements).toHaveLength(3);
    expect(result.placements.map((item) => item.userFurnitureId)).toEqual(placedFurnitureMock().map((item) => item.userFurnitureId));
    expect(Object.keys(result.placements[0]).sort()).toEqual(["layer", "placementDirection", "placementStatus", "positionX", "positionY", "userFurnitureId"]);
  });

  it("화면에 없는 서버 가구는 원본 좌표·방향·layer 그대로 포함한다", () => {
    const hidden = placedExtra(900);
    const snapshot = toUserFurnitures([...furnitureListMock(), hidden]);
    const result = buildPlacementsRequest(draft(), snapshot);
    expect(result.placements.find((item) => item.userFurnitureId === 900)).toEqual({
      userFurnitureId: 900, placementStatus: "FLOOR", placementDirection: "FRONT_LEFT", positionX: 123.123, positionY: 500.001, layer: -3,
    });
  });

  it("사용자가 보관한 일반 가구는 원본 목록에 설치되어 있어도 제외한다", () => {
    const snapshot = toUserFurnitures([...furnitureListMock(), placedExtra(900, "desk_black")]);
    expect(buildPlacementsRequest(draft(), snapshot).placements).toHaveLength(3);
  });

  it("필수 종류를 이미지 키가 아닌 서버 분류로 검사한다", () => {
    const snapshot = owned().map((item) => item.furnitureType === "SOFA" ? { ...item, furnitureType: null } : item);
    expect(() => buildPlacementsRequest(draft(), snapshot)).toThrow("소파 0개");
    const hidden = { ...placedExtra(900), furnitureType: "SOFA" as const };
    expect(() => buildPlacementsRequest(draft(), toUserFurnitures([...furnitureListMock(), hidden]))).toThrow("소파 2개");
  });

  it("기본 가구도 보관함에 들어가고 다시 배치할 수 있다", () => {
    const sofa = draft().find((item) => item.itemId === "sofa_default")!;
    expect(storeAwayBlock(sofa, owned())).toBeNull();
    expect(storedFurnitures(owned(), draft().filter((item) => item.itemId !== "sofa_default")))
      .toEqual(expect.arrayContaining([expect.objectContaining({ itemId: "sofa_default" })]));
    expect(storeAwayBlock({ itemId: "board", anchor: { x: 0, y: 0 } }, owned())).toBe("WALL_OBJECT");
    expect(storeAwayBlock({ ...sofa, userFurnitureId: undefined }, owned())).toBe("UNKNOWN_FURNITURE");
    expect(storeAwayBlock(sofa, undefined)).toBe("UNKNOWN_FURNITURE");
  });

  it("원본 배치나 종류가 계약과 다르면 누락시키지 않고 읽기를 실패시킨다", () => {
    expect(() => toUserFurniture({ ...placedExtra(900), positionY: null })).toThrow(ContractMismatchError);
    expect(() => toUserFurniture({ ...placedExtra(900), placementDirection: "BACK" })).toThrow(ContractMismatchError);
    expect(() => toUserFurniture({ ...placedExtra(900), furnitureType: undefined } as unknown as UserFurnitureDto)).toThrow(ContractMismatchError);
    expect(() => toUserFurnitures([furnitureListMock()[0], furnitureListMock()[0]])).toThrow(ContractMismatchError);
  });

  it("누락·중복·미보유 ID·잘못된 면을 거절한다", () => {
    const initial = request();
    expect(() => validatePlacements({ placements: initial.placements.slice(1) }, owned())).toThrow("종류별로 1개");
    expect(() => validatePlacements({ placements: [...initial.placements, initial.placements[0]] }, owned())).toThrow("배치 정보");
    expect(() => validatePlacements({ placements: [{ ...initial.placements[0], userFurnitureId: 999 }] }, owned())).toThrow("보유 가구가 변경");
    expect(() => validatePlacements({ placements: [{ ...initial.placements[0], placementStatus: "RIGHT_WALL" }] }, owned())).toThrow("면을 확인");
  });

  it.each([{ positionX: 327.001 }, { positionY: 586.001 }, { positionY: 0.0001 }, { layer: 1.5 }, { positionX: NaN }, { positionY: Infinity }])(
    "계약 밖 수치를 거절한다: %j", (invalid) => {
      const initial = request();
      initial.placements[0] = { ...initial.placements[0], ...invalid };
      expect(() => validatePlacements(initial, owned())).toThrow("배치 정보");
    }
  );

  it("좌표 상한과 음수 정수 layer를 허용하고 100개 초과는 거절한다", () => {
    const extras = Array.from({ length: 98 }, (_, index) => placedExtra(900 + index));
    const snapshot = toUserFurnitures([...furnitureListMock(), ...extras]);
    const initial = request();
    initial.placements[0] = { ...initial.placements[0], positionX: 327, positionY: 586, layer: -2 };
    expect(() => validatePlacements(initial, owned())).not.toThrow();
    initial.placements.push(...snapshot.filter((item) => item.userFurnitureId >= 900).map((item) => item.serverPlacement!));
    expect(() => validatePlacements(initial, snapshot)).toThrow("100개");
    expect(() => validatePlacements({ placements: initial.placements.slice(0, 100) }, snapshot)).not.toThrow();
  });
});

describe("일괄 저장 Mock", () => {
  it("보드·캘린더는 서버 보유 목록에 없고 구매 가구의 종류는 보존한다", () => {
    expect(furnitureListMock()).toHaveLength(7);
    expect(furnitureListMock("WALL").map((item) => item.assetKey)).toEqual(["window_sky_clouds"]);
    acquireFurnitureMock(18, 900, "sofa_black");
    expect(furnitureListMock().find((item) => item.userFurnitureId === 900)).toMatchObject({ furnitureType: "SOFA", defaultFurnitureType: null, canUnplace: true });
  });

  it("3종 교체·재교체·동일 요청 재시도에서 딱지와 보유를 보존한다", () => {
    resetFurnitureMocks(furnitureListMock().map((item) => ({ ...item, stickerAttached: item.placed })));
    const initial = request();
    ["refrigerator_black", "sofa_black", "tv_set_black"].forEach((asset, index) => acquireFurnitureMock(900 + index, 900 + index, asset));
    const all = owned();
    const replacement = { placements: initial.placements.map((placement) => {
      const original = all.find((item) => item.userFurnitureId === placement.userFurnitureId)!;
      const next = all.find((item) => item.userFurnitureId >= 900 && item.furnitureType === original.furnitureType)!;
      return { ...placement, userFurnitureId: next.userFurnitureId };
    }) };
    const result = updateFurniturePlacementsMock(replacement);
    expect(result.filter((item) => item.placed).map((item) => item.userFurnitureId)).toEqual([900, 901, 902]);
    expect(result.filter((item) => item.stickerAttached)).toHaveLength(3);
    expect(result.filter((item) => item.defaultFurnitureType !== null).every((item) => !item.placed && item.canUnplace && !item.stickerAttached)).toBe(true);
    expect(updateFurniturePlacementsMock(replacement)).toEqual(result);
    const restored = updateFurniturePlacementsMock(initial);
    expect(restored.filter((item) => item.placed && item.stickerAttached)).toHaveLength(3);
    expect(restored.filter((item) => item.userFurnitureId >= 900).every((item) => !item.placed && !item.stickerAttached)).toBe(true);
    expect(restored).toHaveLength(10);
  });

  it("검증 실패 시 일부 배치도 변경하지 않는다", () => {
    const before = furnitureListMock();
    const invalid = request();
    invalid.placements[0].positionX = 10;
    invalid.placements.pop();
    expect(() => updateFurniturePlacementsMock(invalid)).toThrow();
    expect(furnitureListMock()).toEqual(before);
  });
});

describe("API와 오류", () => {
  it("전체 요청을 PUT 한 번으로 보내고 전체 응답을 변환한다", async () => {
    jest.spyOn(client, "isMocked").mockReturnValue(false);
    expect(isMocked("room")).toBe(false);
    const put = jest.spyOn(api, "put").mockResolvedValue({ data: furnitureListMock() });
    const patch = jest.spyOn(api, "patch");
    const payload = request();
    expect(await updateFurniturePlacements(payload)).toHaveLength(7);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith("/furnitures/placements", payload);
    expect(patch).not.toHaveBeenCalled();
  });

  it("네트워크·보유 가구·필수 개수 오류를 구분한다", () => {
    expect(placementErrorMessage(new ApiError(0, "TIMEOUT", ""))).toContain("연결 상태");
    expect(placementErrorMessage(new ApiError(404, "FURNITURE_001", ""))).toContain("보유 가구가 변경");
    expect(placementErrorMessage(new ApiError(409, "FURNITURE_004", "소파를 1개 배치해 주세요."))).toBe("소파를 1개 배치해 주세요.");
  });
});
