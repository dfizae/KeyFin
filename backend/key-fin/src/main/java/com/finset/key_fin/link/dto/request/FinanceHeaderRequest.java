package com.finset.key_fin.link.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public record FinanceHeaderRequest(
		@JsonProperty("Header") FinanceRequestHeader header
) {
}
