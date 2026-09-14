package com.finset.key_fin.transaction.dto.request;

import com.finset.key_fin.transaction.entity.ExcludeTag;
import io.swagger.v3.oas.annotations.media.Schema;

public record TransactionClassificationRequest(
		@Schema(description = "확정할 세분류 ID. excludeTag와 동시에 입력할 수 없음", example = "102", nullable = true)
		Integer subcategoryId,
		@Schema(description = "예산 제외 태그. DUTCH 또는 SELF_TRANSFER", example = "DUTCH", nullable = true)
		ExcludeTag excludeTag,
		@Schema(description = "더치페이 실제 부담액. DUTCH일 때만 필수", example = "15000", nullable = true)
		Long adjustedAmount
) {
}
