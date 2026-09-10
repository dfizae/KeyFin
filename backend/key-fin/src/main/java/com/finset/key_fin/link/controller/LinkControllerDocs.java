package com.finset.key_fin.link.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.request.LinkAssetsRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.dto.response.LinkAssetsResponse;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse;
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

@Tag(
		name = "금융망 연결",
		description = "금융망 회원 연결 및 연결 상태 조회 API입니다. Access Token이 필요합니다."
)
public interface LinkControllerDocs {

	@Operation(
			summary = "금융망 회원 연결",
			description = "사용자가 입력한 금융망 가입 이메일로 회원을 조회하고 현재 KeyFin 계정에 연결합니다. "
					+ "동일한 금융망 회원과의 재연결은 성공으로 처리합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "금융망 회원 연결 성공",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(
									value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":{\"connected\":true}}"
							)
					)
			),
			@ApiResponse(
					responseCode = "400",
					description = "입력값 오류 또는 읽을 수 없는 요청 본문",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = {
									@ExampleObject(name = "입력값 오류", value = "{\"success\":false,\"code\":\"COMMON_001\",\"message\":\"입력값이 올바르지 않습니다.\",\"data\":null}"),
									@ExampleObject(name = "요청 본문 오류", value = "{\"success\":false,\"code\":\"COMMON_002\",\"message\":\"요청 본문을 읽을 수 없습니다.\",\"data\":null}")
							}
					)
			),
			@ApiResponse(
					responseCode = "401",
					description = "Access Token이 없거나 유효하지 않음",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(value = "{\"success\":false,\"code\":\"AUTH_002\",\"message\":\"유효하지 않은 토큰입니다.\",\"data\":null}")
					)
			),
			@ApiResponse(
					responseCode = "404",
					description = "KeyFin 사용자 또는 금융망 회원을 찾을 수 없음",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = {
									@ExampleObject(name = "사용자 없음", value = "{\"success\":false,\"code\":\"USER_001\",\"message\":\"사용자를 찾을 수 없습니다.\",\"data\":null}"),
									@ExampleObject(name = "금융망 회원 없음", value = "{\"success\":false,\"code\":\"FINANCE_001\",\"message\":\"금융망에서 일치하는 사용자를 찾을 수 없습니다.\",\"data\":null}")
							}
					)
			),
			@ApiResponse(
					responseCode = "409",
					description = "기존 연결과 충돌하거나 다른 계정에서 이미 연결한 금융망 회원",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = {
									@ExampleObject(name = "기존 연결 충돌", value = "{\"success\":false,\"code\":\"USER_004\",\"message\":\"이미 다른 금융망 사용자와 연결되어 있습니다.\",\"data\":null}"),
									@ExampleObject(name = "다른 계정에서 연결", value = "{\"success\":false,\"code\":\"LINK_001\",\"message\":\"해당 금융망 사용자는 이미 다른 계정과 연결되어 있습니다.\",\"data\":null}")
							}
					)
			),
			@ApiResponse(responseCode = "502", description = "금융망 응답 또는 연동 설정 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "503", description = "일시 장애 재시도 후 금융망 서비스 이용 불가", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<FinanceLinkResponse> connect(
			@Parameter(hidden = true) Long userId,
			@io.swagger.v3.oas.annotations.parameters.RequestBody(
					description = "금융망 가입 이메일",
					required = true
			)
			FinanceLinkRequest request
	);

	@Operation(
			summary = "금융망 연결 상태 조회",
			description = "현재 로그인한 KeyFin 계정의 금융망 연결 여부를 조회합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "금융망 연결 상태 조회 성공",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(
									value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":{\"connected\":true}}"
							)
					)
			),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "KeyFin 사용자를 찾을 수 없음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<FinanceLinkResponse> getStatus(@Parameter(hidden = true) Long userId);

	@Operation(
			summary = "금융망 계좌·카드 후보 목록 조회",
			description = "연결된 금융망 회원의 수시입출금 계좌와 카드 목록을 조회하고, 각 항목의 KeyFin 연결 여부(linked)를 함께 반환합니다. "
					+ "금융망 회원이 연결되지 않은 사용자는 409로 거절됩니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "200",
					description = "후보 목록 조회 성공",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(
									value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":{"
											+ "\"accounts\":[{\"finAccountNo\":\"0010011073486799\",\"bankCode\":\"001\",\"bankName\":\"한국은행\",\"balance\":1500000,\"linked\":false,\"linkedId\":null}],"
											+ "\"cards\":[{\"cardNo\":\"1003198565339181\",\"issuerName\":\"롯데카드\",\"cardName\":\"디지로카 SEOUL\",\"withdrawalAccountNo\":\"0323555042323510\",\"linked\":true,\"linkedId\":7}]}}"
							)
					)
			),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "KeyFin 사용자를 찾을 수 없음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(
					responseCode = "409",
					description = "금융망 회원 미연결 또는 금융망 연결이 더 이상 유효하지 않음",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = {
									@ExampleObject(name = "금융망 미연결", value = "{\"success\":false,\"code\":\"LINK_002\",\"message\":\"금융망 연결이 필요합니다. 먼저 금융망 회원을 연결해 주세요.\",\"data\":null}"),
									@ExampleObject(name = "연결 무효", value = "{\"success\":false,\"code\":\"FINANCE_005\",\"message\":\"금융망 연결이 유효하지 않습니다. 금융망을 다시 연결해 주세요.\",\"data\":null}")
							}
					)
			),
			@ApiResponse(responseCode = "502", description = "금융망 응답 또는 연동 설정 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "503", description = "일시 장애 재시도 후 금융망 서비스 이용 불가", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<LinkCandidatesResponse> getCandidates(@Parameter(hidden = true) Long userId);

	@Operation(
			summary = "선택 계좌·카드 연결",
			description = "후보 목록에서 선택한 금융망 계좌·카드를 KeyFin 관리 대상으로 저장합니다. "
					+ "후보 목록에 없는 자산은 404로 거절하고, 이미 연결된 항목은 건너뛰어 응답 수에 포함하지 않습니다(멱등). "
					+ "카드의 청구 출금 계좌는 같은 요청 또는 이전에 연결된 계좌에서 매칭합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(
					responseCode = "201",
					description = "연결 성공 — 새로 연결된 계좌·카드 수",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":{\"accounts\":2,\"cards\":1}}")
					)
			),
			@ApiResponse(
					responseCode = "400",
					description = "입력값 오류 또는 선택 항목 없음",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = {
									@ExampleObject(name = "입력값 오류", value = "{\"success\":false,\"code\":\"COMMON_001\",\"message\":\"입력값이 올바르지 않습니다.\",\"data\":null}"),
									@ExampleObject(name = "선택 항목 없음", value = "{\"success\":false,\"code\":\"LINK_003\",\"message\":\"연결할 계좌 또는 카드를 하나 이상 선택해 주세요.\",\"data\":null}")
							}
					)
			),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(
					responseCode = "404",
					description = "KeyFin 사용자 없음 또는 금융망 후보 목록에 없는 자산",
					content = @Content(
							mediaType = APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = BaseResponse.class),
							examples = @ExampleObject(value = "{\"success\":false,\"code\":\"LINK_004\",\"message\":\"금융망에서 선택한 계좌 또는 카드를 찾을 수 없습니다.\",\"data\":null}")
					)
			),
			@ApiResponse(responseCode = "409", description = "금융망 회원 미연결(LINK_002) 또는 연결 무효(FINANCE_005)", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "502", description = "금융망 응답 또는 연동 설정 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "503", description = "일시 장애 재시도 후 금융망 서비스 이용 불가", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<LinkAssetsResponse> link(
			@Parameter(hidden = true) Long userId,
			@io.swagger.v3.oas.annotations.parameters.RequestBody(description = "연결할 계좌번호·카드번호 목록", required = true)
			LinkAssetsRequest request
	);

	@Operation(
			summary = "계좌 연결 해제",
			description = "연결 계좌를 관리 대상에서 제외합니다(is_managed=false). 거래 이력은 보존되며, 다시 연결하려면 선택 연결 API를 사용합니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "연결 해제 성공", content = @Content(mediaType = APPLICATION_JSON_VALUE, schema = @Schema(implementation = BaseResponse.class), examples = @ExampleObject(value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":null}"))),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "사용자 없음 또는 본인 계좌가 아님(LINK_005)", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<Void> unlinkAccount(
			@Parameter(hidden = true) Long userId,
			@Parameter(description = "KeyFin 계좌 ID", example = "3") long accountId
	);

	@Operation(
			summary = "카드 연결 해제",
			description = "연결 카드를 관리 대상에서 제외합니다(is_managed=false). 거래 이력은 보존됩니다.",
			security = @SecurityRequirement(name = "bearerAuth")
	)
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "연결 해제 성공", content = @Content(mediaType = APPLICATION_JSON_VALUE, schema = @Schema(implementation = BaseResponse.class), examples = @ExampleObject(value = "{\"success\":true,\"code\":\"SUCCESS\",\"message\":\"요청이 성공했습니다.\",\"data\":null}"))),
			@ApiResponse(responseCode = "401", description = "Access Token이 없거나 유효하지 않음", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "404", description = "사용자 없음 또는 본인 카드가 아님(LINK_006)", content = @Content(schema = @Schema(implementation = BaseResponse.class))),
			@ApiResponse(responseCode = "500", description = "서버 내부 오류", content = @Content(schema = @Schema(implementation = BaseResponse.class)))
	})
	BaseResponse<Void> unlinkCard(
			@Parameter(hidden = true) Long userId,
			@Parameter(description = "KeyFin 카드 ID", example = "2") long cardId
	);
}
