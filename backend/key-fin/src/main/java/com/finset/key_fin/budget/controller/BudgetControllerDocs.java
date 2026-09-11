package com.finset.key_fin.budget.controller;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

import com.finset.key_fin.budget.dto.request.BudgetConfirmRequest;
import com.finset.key_fin.budget.dto.response.BudgetConfirmResponse;
import com.finset.key_fin.budget.dto.response.BudgetProposalResponse;
import com.finset.key_fin.global.base.BaseResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(
		name = "예산",
		description = "카테고리(봉투)별 예산 제안·승인·조회를 제공합니다."
)
public interface BudgetControllerDocs {

	@Operation(
			summary = "예산 제안 생성",
			description = "요청 시점과 사용자의 예산 기준일로 현재 주기를 정해, 직전 3개월 순소비를 커버 일수 비례 월평균으로 환산한 "
					+ "봉투 7종의 예산을 제안합니다. 요청 바디 없음. 이력이 없으면 기본 템플릿으로 제안하며, "
					+ "현재 주기의 예산이 이미 있으면 409를 반환합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "예산 제안 생성 성공",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(
									name = "제안 생성 성공",
									value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":{\"budgetId\":11,\"month\":\"202609\",\"status\":\"PROPOSED\",\"basis\":\"최근 3개월 평균\",\"envelopes\":[{\"envelopeId\":1,\"name\":\"외식\",\"proposedAmount\":121000,\"monthlyAvg\":120652}]}}"
							)
					)
			),
			@ApiResponse(
					responseCode = "401",
					description = "Access Token이 없거나 유효하지 않음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "409",
					description = "해당 주기의 예산이 이미 존재",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "500",
					description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			)
	})
	BaseResponse<BudgetProposalResponse> propose(Long userId);

	@Operation(
			summary = "예산 승인·조정",
			description = "제안(PROPOSED) 상태인 예산의 봉투 7종 전부에 확정 금액을 기록하고 CONFIRMED로 전환합니다. "
					+ "금액은 0 이상 1,000원 단위. 제안액(proposedAmount)은 보존됩니다. "
					+ "확정은 주기당 1회 — 이미 CONFIRMED면 409를 반환합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "예산 확정 성공",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(
									name = "확정 성공",
									value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":{\"budgetId\":11,\"month\":\"202609\",\"status\":\"CONFIRMED\"}}"
							)
					)
			),
			@ApiResponse(
					responseCode = "400",
					description = "봉투 목록이 예산 구성과 불일치, 금액이 음수 또는 1,000원 단위 아님",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "401",
					description = "Access Token이 없거나 유효하지 않음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "404",
					description = "본인 소유의 예산이 아니거나 존재하지 않음",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "409",
					description = "이미 확정된 예산",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			),
			@ApiResponse(
					responseCode = "500",
					description = "서버 내부 오류",
					content = @Content(schema = @Schema(implementation = BaseResponse.class))
			)
	})
	BaseResponse<BudgetConfirmResponse> confirm(Long userId, Long budgetId, BudgetConfirmRequest request);
}
