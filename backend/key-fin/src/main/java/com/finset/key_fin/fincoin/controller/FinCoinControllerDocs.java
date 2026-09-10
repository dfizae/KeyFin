package com.finset.key_fin.fincoin.controller;

import com.finset.key_fin.fincoin.dto.response.FinCoinResponse;
import com.finset.key_fin.global.base.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Tag(name = "코인", description = "인증된 사용자의 코인 잔액과 지급·사용 이력을 제공합니다.")
public interface FinCoinControllerDocs {

	@Operation(
			summary = "코인 잔액 및 이력 조회",
			description = "이력을 ID 내림차순으로 조회합니다. cursor를 생략하면 최신 이력부터, "
					+ "전달하면 해당 ID 미만의 이력부터 조회합니다. cursor는 이력의 존재 여부와 관계없이 조회 경계로 사용합니다. "
					+ "balance는 커서와 무관한 현재 잔액이며, 마지막 페이지의 nextCursor는 null입니다. "
					+ "이력이 없으면 balance는 0, items는 빈 배열입니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "코인 조회 성공",
					useReturnTypeSchema = true,
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							examples = @ExampleObject(value = """
								{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.",
								 "data":{"balance":1250,"items":[{"id":42,"delta":-100,"balanceAfter":1250,
								 "reasonCode":"PURCHASE","reasonText":"아이템 구매","grantDate":"2026-09-10"}],
								 "nextCursor":null}}
								""")
					)
			),
			@ApiResponse(responseCode = "400", description = "잘못된 cursor 또는 size (COMMON_001)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않거나 만료됨",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "403", description = "접근 권한 없음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "활성 사용자를 찾을 수 없음 (USER_001)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<FinCoinResponse> getFinCoins(
			@Parameter(hidden = true) Long userId,
			@Parameter(description = "마지막으로 조회한 이력 ID. 양수이며 선택 파라미터",
					schema = @Schema(type = "integer", format = "int64", minimum = "1"))
			@Positive Long cursor,
			@Parameter(description = "페이지 크기 (1~100), 기본값 20",
					schema = @Schema(type = "integer", format = "int32", defaultValue = "20", minimum = "1", maximum = "100"))
			@Min(1) @Max(100) Integer size
	);
}
