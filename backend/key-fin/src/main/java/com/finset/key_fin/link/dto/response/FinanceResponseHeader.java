package com.finset.key_fin.link.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FinanceResponseHeader(
		String responseCode,
		String responseMessage
) {
}
