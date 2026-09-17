package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.user.dto.request.NotificationSettingsUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;

@Tag(name = "알림 설정", description = "알림 유형별 수신 여부와 방해금지 시간 설정 API입니다. Access Token이 필요합니다.")
public interface NotificationSettingsControllerDocs {

	@Operation(
			summary = "알림 설정 변경",
			description = "알림 유형별 수신 여부와 방해금지 시간을 변경합니다. 방해금지 시작·종료 시각을 모두 생략하면 방해금지를 해제합니다. "
					+ "자정을 지나는 시간 범위(예: 23:00~08:00)도 설정할 수 있습니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "알림 설정 변경 성공"),
			@ApiResponse(responseCode = "400", description = "입력값 또는 방해금지 시간 설정이 올바르지 않음 (COMMON_001, USER_009)",
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
	ResponseEntity<Void> updateNotificationSettings(
			@Parameter(hidden = true) Long userId,
			NotificationSettingsUpdateRequest request
	);
}
