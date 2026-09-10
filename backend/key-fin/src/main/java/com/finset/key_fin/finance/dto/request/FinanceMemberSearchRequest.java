package com.finset.key_fin.finance.dto.request;

public record FinanceMemberSearchRequest(
		String apiKey,
		String userId
) {

	@Override
	public String toString() {
		return "FinanceMemberSearchRequest[apiKey=******, userId=" + userId + "]";
	}
}
