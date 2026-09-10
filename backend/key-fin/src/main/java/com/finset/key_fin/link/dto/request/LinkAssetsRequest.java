package com.finset.key_fin.link.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record LinkAssetsRequest(
		@Schema(description = "연결할 금융망 계좌번호 목록", example = "[\"0041456503815897\"]")
		@Size(max = 50, message = "계좌는 한 번에 50개까지 연결할 수 있습니다.")
		List<@NotBlank(message = "계좌번호는 비어 있을 수 없습니다.") String> accounts,
		@Schema(description = "연결할 금융망 카드번호 목록", example = "[\"1005872701650761\"]")
		@Size(max = 50, message = "카드는 한 번에 50개까지 연결할 수 있습니다.")
		List<@NotBlank(message = "카드번호는 비어 있을 수 없습니다.") String> cards
) {

	public List<String> accountsOrEmpty() {
		return accounts == null ? List.of() : accounts;
	}

	public List<String> cardsOrEmpty() {
		return cards == null ? List.of() : cards;
	}

	public boolean isEmpty() {
		return accountsOrEmpty().isEmpty() && cardsOrEmpty().isEmpty();
	}
}
