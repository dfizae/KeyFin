package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;

@Tag(name = "코치 설정", description = "코칭 메시지에 사용할 코치 말투 설정 API입니다. Access Token이 필요합니다.")
public interface CoachSettingsControllerDocs {

	@Operation(
			summary = "코치 말투 변경",
			description = "코치 말투를 PLAIN, DODO, ONSOON, JIBANG 중 하나로 변경합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "코치 말투 변경 성공"),
			@ApiResponse(responseCode = "400",
					description = "코치 말투 누락 (COMMON_001) 또는 지원하지 않는 값이라 요청 본문을 읽을 수 없음 (COMMON_002)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않거나 만료됨",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "403", description = "접근 권한 없음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "활성 사용자 또는 사용자 설정을 찾을 수 없음 (USER_001, USER_006)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	ResponseEntity<Void> updateCoachPersona(
			@Parameter(hidden = true) Long userId,
			CoachPersonaUpdateRequest request
	);
}
