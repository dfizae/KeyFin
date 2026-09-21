package com.finset.key_fin.room.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record StickerStatusResponse(
		@Schema(description = "남은 딱지 수", minimum = "0", maximum = "3", requiredMode = Schema.RequiredMode.REQUIRED) int count,
		@Schema(description = "기본 가구 3종의 전체 딱지 수", allowableValues = {"3"}, requiredMode = Schema.RequiredMode.REQUIRED) int total,
		@Schema(description = "딱지가 남아 있고 한국 시간 기준 오늘 제거하지 않았는지", requiredMode = Schema.RequiredMode.REQUIRED) boolean removableToday
) {
}
