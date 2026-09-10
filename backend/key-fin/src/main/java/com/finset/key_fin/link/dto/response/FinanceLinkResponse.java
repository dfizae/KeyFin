package com.finset.key_fin.link.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record FinanceLinkResponse(
		@Schema(description = "금융망 연결 여부", example = "true")
		boolean connected
) {

	public static FinanceLinkResponse of(boolean connected) {
		return new FinanceLinkResponse(connected);
	}
}
