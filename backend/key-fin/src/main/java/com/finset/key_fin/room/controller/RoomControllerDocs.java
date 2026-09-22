package com.finset.key_fin.room.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.room.dto.response.RoomResponse;
import com.finset.key_fin.room.dto.response.StickerRemovalResponse;
import com.finset.key_fin.room.dto.request.StickerRemovalRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Tag(
		name = "방",
		description = "방 초기 화면에 필요한 아바타, 가구, 코인과 출석 데이터를 제공합니다."
)
public interface RoomControllerDocs {

	@Operation(
			summary = "방 홈 화면 데이터 조회",
			description = "인증된 사용자의 방 초기 화면 데이터를 조회합니다. avatar.equipped는 실제 장착 상태이며 "
					+ "미장착 부위는 모바일에서 기본 에셋을 표시합니다. furnitures는 실제 설치된 가구를 보유 가구 ID "
					+ "오름차순으로 반환하며 미설치 가구는 제외합니다. 코인은 최신 원장의 잔액이며 원장이 없으면 0입니다. "
					+ "출석은 한국 시간 기준 오늘 ATTEND 원장의 존재 여부이며, 조회 시 출석 보상을 지급하지 않습니다. "
					+ "현재 확정 예산 초과를 동기화해 설치된 필수 가구 4종의 딱지 상태를 반환합니다. "
					+ "필수 가구는 단독 해제할 수 없으며 일괄 배치 저장으로 같은 종류의 구매 가구와 교체할 수 있습니다. avatar.reaction은 현재 null입니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "방 홈 화면 데이터 조회 성공",
					useReturnTypeSchema = true,
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							examples = @ExampleObject(
									name = "방 조회 성공",
									value = """
											{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.","data":{
											 "avatar":{"equipped":[{"userItemId":101,"slotType":"HEAD","itemId":1,"assetKey":"hat_blue"}],"reaction":null},
											 "furnitures":[{"userFurnitureId":201,"itemId":4,"slotType":"FLOOR","assetKey":"sofa_default",
											 "placementStatus":"FLOOR","placementDirection":"FRONT_RIGHT","positionX":164.875,"positionY":226.000,"layer":0,
											 "defaultFurnitureType":"SOFA","furnitureType":"SOFA","stickerAttached":false,"canUnplace":false}],
											 "coin":{"balance":0},"attendance":{"checkedToday":false},"stickers":{"count":0,"total":4,"removableToday":false}}}
											"""
							)
					)
			),
			@ApiResponse(
					responseCode = "401",
					description = "Access Token이 없거나 유효하지 않음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "활성 사용자를 찾을 수 없음 (USER_001)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "500",
					description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			)
	})
	BaseResponse<RoomResponse> getRoom(Long userId);

	@Operation(summary = "압류 딱지 한 개 제거",
			description = "인증 사용자 소유의 현재 설치된 필수 가구에서 딱지 한 개를 제거합니다. 구매한 색상 가구도 대상입니다. 한국 시간 기준 사용자당 하루 한 번이며 "
					+ "같은 예산에서 재부착되지 않습니다. 다음 예산 초과로 다시 부착되어도 당일 제거 제한은 유지합니다.",
			security = @SecurityRequirement(name = "bearerAuth"))
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "제거 성공", useReturnTypeSchema = true,
					content = @Content(mediaType = APPLICATION_JSON_VALUE, examples = @ExampleObject(value = """
							{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.","data":{
							"userFurnitureId":123,"stickerAttached":false,"stickers":{"count":3,"total":4,"removableToday":false}}}
							"""))),
			@ApiResponse(responseCode = "400", description = "입력 오류 (COMMON_001/COMMON_002), 설치된 필수 가구가 아님 (ROOM_001)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "401", description = "인증 실패", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "활성 사용자 없음 (USER_001), 보유 가구 없음 (FURNITURE_001)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "409", description = "오늘 이미 제거 (ROOM_002), 대상 딱지 없음 (ROOM_003)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<StickerRemovalResponse> removeSticker(Long userId, StickerRemovalRequest request);
}
