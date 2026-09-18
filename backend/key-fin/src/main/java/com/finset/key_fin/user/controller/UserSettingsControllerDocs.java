package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.dto.request.NotificationSettingsUpdateRequest;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
import com.finset.key_fin.user.dto.response.TransferSettingsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Tag(name = "사용자 설정", description = "이체·알림·코치 말투 등 사용자 설정 API입니다. Access Token이 필요합니다.")
public interface UserSettingsControllerDocs {

	@Operation(
			summary = "이체 설정 조회",
			description = "현재 로그인한 사용자의 이체 동의 여부와 1회·1일 이체 한도를 조회합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "이체 설정 조회 성공", useReturnTypeSchema = true,
					content = @Content(mediaType = APPLICATION_JSON_VALUE,
							examples = @ExampleObject(value = """
									{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.","data":{"transferConsent":true,"transferLimitOnce":1000000,"transferLimitDaily":2000000}}
									"""))),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않거나 만료됨",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "403", description = "접근 권한 없음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "활성 사용자 또는 사용자 설정을 찾을 수 없음 (USER_001, USER_006)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<TransferSettingsResponse> getTransferSettings(@Parameter(hidden = true) Long userId);

	@Operation(
			summary = "이체 설정 변경",
			description = "이체 동의 여부와 1회·1일 이체 한도를 변경합니다. 1일 한도는 1회 한도보다 작을 수 없습니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "이체 설정 변경 성공", useReturnTypeSchema = true),
			@ApiResponse(responseCode = "400", description = "입력값 또는 이체 한도 관계가 올바르지 않음 (COMMON_001, USER_005)",
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
	BaseResponse<TransferSettingsResponse> updateTransferSettings(
			@Parameter(hidden = true) Long userId,
			TransferSettingsUpdateRequest request
	);

	@Operation(
			summary = "알림 설정 변경",
			description = "알림 유형별 수신 여부와 방해금지 시간을 변경합니다. 시작·종료 시각을 모두 생략하면 방해금지를 해제하며 자정을 지나는 범위도 설정할 수 있습니다.",
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

	@Operation(
			summary = "코치 말투 변경",
			description = "코치 말투를 PLAIN, DODO, ONSOON, JIBANG 중 하나로 변경합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "코치 말투 변경 성공"),
			@ApiResponse(responseCode = "400", description = "코치 말투 누락 (COMMON_001) 또는 지원하지 않는 값 (COMMON_002)",
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
