package com.finset.key_fin.link.dto.response;

public record FinanceLinkResponse(
		boolean connected
) {

	public static FinanceLinkResponse success() {
		return new FinanceLinkResponse(true);
	}
}
