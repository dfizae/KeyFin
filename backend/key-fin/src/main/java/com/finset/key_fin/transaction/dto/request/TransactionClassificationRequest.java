package com.finset.key_fin.transaction.dto.request;

import com.finset.key_fin.transaction.entity.ExcludeTag;
import io.swagger.v3.oas.annotations.media.Schema;

public record TransactionClassificationRequest(
		@Schema(description = "확정할 세분류 ID. 환급(RESTORE)은 excludeTag와 함께 입력", example = "102", nullable = true)
		Integer subcategoryId,
		@Schema(description = "거래 처리 태그. DUTCH, SELF_TRANSFER, EMERGENCY 또는 환급 입금의 RESTORE", example = "DUTCH", nullable = true)
		ExcludeTag excludeTag,
		@Schema(description = "더치페이 실제 부담액. DUTCH일 때만 필수", example = "15000", nullable = true)
		Long adjustedAmount
) {
}
