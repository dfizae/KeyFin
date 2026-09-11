package com.finset.key_fin.account.controller;

import com.finset.key_fin.account.dto.response.AccountListResponse;
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

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Tag(name = "계좌 관리", description = "연결 계좌 조회 및 관리 API입니다. Access Token이 필요합니다.")
public interface AccountControllerDocs {

	@Operation(
			summary = "내 연결 계좌 목록 조회",
			description = "현재 로그인한 사용자가 관리 중인 계좌를 ID 오름차순으로 조회합니다. "
					+ "잔액과 잔액 업데이트 시각은 마지막 금융망 동기화 기준입니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "연결 계좌 목록 조회 성공",
					useReturnTypeSchema = true,
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							examples = @ExampleObject(value = """
									{"success":true,"code":"SUCCESS","message":"요청이 성공했습니다.","data":{"items":[{"id":3,"finAccountNo":"0010011073486799","bankName":"한국은행","alias":"생활비","isIncome":true,"isManaged":true,"balance":1500000,"balanceUpdatedAt":"2026-09-11T14:30:00"}]}}
									""")
					)
			),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않거나 만료됨",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "403", description = "접근 권한 없음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "활성 사용자를 찾을 수 없음 (USER_001)",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<AccountListResponse> getAccounts(@Parameter(hidden = true) Long userId);
}
