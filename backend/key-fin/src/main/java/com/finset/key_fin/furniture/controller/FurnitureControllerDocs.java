package com.finset.key_fin.furniture.controller;

import com.finset.key_fin.furniture.dto.request.FurniturePlacementUpdateRequest;
import com.finset.key_fin.furniture.dto.response.UserFurnitureResponse;
import com.finset.key_fin.global.base.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import java.util.List;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Tag(name = "가구", description = "내 보유 가구 조회 및 설치·이동·해제")
@SecurityRequirement(name = "bearerAuth")
@ApiResponses({
		@ApiResponse(responseCode = "400", description = "잘못된 slotType 또는 userFurnitureId (COMMON_001)",
				content = @Content(schema = @Schema(implementation = BaseResponse.class))),
		@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않음",
				content = @Content(schema = @Schema(implementation = BaseResponse.class))),
		@ApiResponse(responseCode = "404", description = "활성 사용자 없음 (USER_001) 또는 보유 가구 없음 (FURNITURE_001)",
				content = @Content(schema = @Schema(implementation = BaseResponse.class))),
		@ApiResponse(responseCode = "500", description = "서버 내부 오류",
				content = @Content(schema = @Schema(implementation = BaseResponse.class)))
})
public interface FurnitureControllerDocs {
	@Operation(summary = "보유 가구 조회", description = "설치·미설치 가구를 보유 가구 ID 오름차순으로 반환합니다. "
			+ "slotType 생략 시 전체 조회하며 결과가 없으면 빈 배열입니다. 판매 중지된 상품도 이미 보유했다면 포함합니다. "
			+ "defaultFurnitureType은 기본 가구 식별값이며 일반 가구는 null입니다. stickerAttached는 딱지 부착 상태, canUnplace는 설치 해제 가능 여부입니다.")
	@ApiResponse(responseCode = "200", description = "조회 성공", useReturnTypeSchema = true,
			content = @Content(mediaType = APPLICATION_JSON_VALUE, examples = @ExampleObject(value = """
					{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.",
					 "data":[{"userFurnitureId":201,"itemId":4,"name":"파란 소파","slotType":"FLOOR",
					 "assetKey":"sofa_blue","placed":false,"placementStatus":null,"placementDirection":null,
					 "positionX":null,"positionY":null,"layer":0,"defaultFurnitureType":null,"stickerAttached":false,"canUnplace":true}]}
					""")))
	BaseResponse<List<UserFurnitureResponse>> getFurnitures(
			@Parameter(hidden = true) Long userId,
			@Parameter(description = "가구의 설치 가능 유형. 빈 값은 허용하지 않음",
					schema = @Schema(type = "string", allowableValues = {"FLOOR", "WALL"})) String slotType
	);

	@Operation(summary = "가구 배치 상태 변경", description = "placed=true이면 면·방향·좌표를 모두 보내 설치하거나 현재 배치를 교체합니다. "
			+ "layer는 생략 또는 null이면 0이며 음수도 허용합니다. placed=false이면 나머지 필드는 생략 또는 null이어야 합니다. "
			+ "일반 가구 해제 시 면·방향·좌표는 null, layer는 0으로 초기화하고 보유 내역은 유지합니다. "
			+ "defaultFurnitureType이 있는 기본 가구는 canUnplace=false이며 이동만 가능합니다. 이동 시 stickerAttached는 유지됩니다. "
			+ "같은 요청을 반복해도 성공하며 변경된 가구를 반환합니다. 타인 소유와 미존재 가구는 같은 오류입니다. "
			+ "좌표는 327×404 씬 기준으로 소수점 최대 3자리입니다. 겹침·격자·실제 면 내부 판정은 클라이언트가 담당합니다.")
	@ApiResponse(responseCode = "200", description = "변경된 가구", useReturnTypeSchema = true,
			content = @Content(mediaType = APPLICATION_JSON_VALUE, examples = {
					@ExampleObject(name = "설치 후", value = """
							{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.",
							 "data":{"userFurnitureId":201,"itemId":4,"name":"파란 소파","slotType":"FLOOR",
							 "assetKey":"sofa_blue","placed":true,"placementStatus":"FLOOR","placementDirection":"FRONT_RIGHT",
							 "positionX":165.000,"positionY":280.000,"layer":0,"defaultFurnitureType":null,"stickerAttached":false,"canUnplace":true}}
							"""),
					@ExampleObject(name = "해제 후", value = """
							{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.",
							 "data":{"userFurnitureId":201,"itemId":4,"name":"파란 소파","slotType":"FLOOR",
							 "assetKey":"sofa_blue","placed":false,"placementStatus":null,"placementDirection":null,
							 "positionX":null,"positionY":null,"layer":0,"defaultFurnitureType":null,"stickerAttached":false,"canUnplace":true}}
							""")
			}))
	@ApiResponse(responseCode = "400", description = "필수값 누락·좌표 범위/정밀도·해제 필드 오류 (COMMON_001), "
			+ "본문 누락·JSON 파싱 오류 (COMMON_002), 가구 유형과 설치 면 불일치 (FURNITURE_002)",
			content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	@ApiResponse(responseCode = "409", description = "기본 가구 설치 해제 불가 (FURNITURE_003)",
			content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	BaseResponse<UserFurnitureResponse> updatePlacement(
			@Parameter(hidden = true) Long userId,
			@Parameter(description = "UserFurniture의 ID. 상품 ID가 아님",
					schema = @Schema(type = "integer", format = "int64", minimum = "1")) @Positive long userFurnitureId,
			@RequestBody(required = true, content = @Content(mediaType = APPLICATION_JSON_VALUE,
					schema = @Schema(implementation = FurniturePlacementUpdateRequest.class), examples = {
							@ExampleObject(name = "설치·이동", value = """
									{"placed":true,"placementStatus":"FLOOR","placementDirection":"FRONT_RIGHT",
									 "positionX":165.000,"positionY":280.000,"layer":0}
									"""),
							@ExampleObject(name = "해제", value = "{\"placed\":false}")
					})) @Valid FurniturePlacementUpdateRequest request
	);
}
