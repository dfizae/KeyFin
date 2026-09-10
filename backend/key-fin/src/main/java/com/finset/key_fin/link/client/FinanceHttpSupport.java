package com.finset.key_fin.link.client;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.exception.FinanceErrorCode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Set;

final class FinanceHttpSupport {

	static final String SUCCESS_RESPONSE_CODE = "H0000";
	private static final Set<Integer> RETRYABLE_STATUS_CODES = Set.of(408, 429, 500, 502, 503, 504);

	private FinanceHttpSupport() {
	}

	static boolean isRetryableStatus(HttpStatusCode statusCode) {
		return RETRYABLE_STATUS_CODES.contains(statusCode.value());
	}

	static RetryableFinanceException retryableResponse(HttpHeaders headers) {
		return new RetryableFinanceException(parseRetryAfter(headers.getFirst(HttpHeaders.RETRY_AFTER)));
	}

	static JsonNode readTree(ObjectMapper objectMapper, String body) {
		if (body == null || body.isBlank()) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
		}
		try {
			return objectMapper.readTree(body);
		} catch (JacksonException exception) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE, exception);
		}
	}

	static <T> T convert(ObjectMapper objectMapper, JsonNode root, Class<T> type) {
		try {
			return objectMapper.treeToValue(root, type);
		} catch (JacksonException exception) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE, exception);
		}
	}

	static String textOrNull(JsonNode node) {
		if (node.isMissingNode() || node.isNull() || !node.isTextual() || node.asText().isBlank()) {
			return null;
		}
		return node.asText();
	}

	static String headerResponseCode(JsonNode root) {
		String responseCode = textOrNull(root.path("Header").path("responseCode"));
		if (responseCode == null) {
			responseCode = textOrNull(root.path("responseCode"));
		}
		return responseCode;
	}

	static Duration parseRetryAfter(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			long seconds = Long.parseLong(value.trim());
			return seconds < 0 ? null : Duration.ofSeconds(seconds);
		} catch (NumberFormatException ignored) {
			try {
				Instant retryAt = ZonedDateTime.parse(value.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
				Duration delay = Duration.between(Instant.now(), retryAt);
				return delay.isNegative() ? Duration.ZERO : delay;
			} catch (DateTimeParseException exception) {
				return null;
			}
		}
	}
}
