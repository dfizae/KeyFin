package com.finset.key_fin.finance.dto.response;

public record FinanceMember(
		String userId,
		String userKey
) {

	@Override
	public String toString() {
		return "FinanceMember[userId=" + userId + ", userKey=******]";
	}
}
