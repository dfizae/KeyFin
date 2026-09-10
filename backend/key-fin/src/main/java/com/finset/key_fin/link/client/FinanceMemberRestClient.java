package com.finset.key_fin.link.client;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.config.FinanceProperties;
import com.finset.key_fin.link.dto.request.FinanceMemberSearchRequest;
import com.finset.key_fin.link.dto.response.FinanceMember;
import com.finset.key_fin.link.dto.response.FinanceMemberSearchResponse;
import com.finset.key_fin.link.exception.FinanceErrorCode;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatusCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class FinanceMemberRestClient implements FinanceMemberClient {

	private static final Logger log = LoggerFactory.getLogger(FinanceMemberRestClient.class);
	private static final String MEMBER_SEARCH_PATH = "/member/search";
	private static final int MAX_USER_KEY_LENGTH = 60;
	private static final Set<Integer> RETRYABLE_STATUS_CODES = Set.of(408, 429, 500, 502, 503, 504);

	private final RestClient financeRestClient;
	private final FinanceProperties properties;
	private final ObjectMapper objectMapper;

	public FinanceMemberRestClient(
			@Qualifier("financeRestClient")
			RestClient financeRestClient,
			FinanceProperties properties,
			ObjectMapper objectMapper
	) {
		this.financeRestClient = financeRestClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Override
	public FinanceMember findByEmail(String email) {
		validateEmail(email);
		FinanceMemberSearchRequest request = new FinanceMemberSearchRequest(
				properties.apiKey(),
				email
		);

		long startedAt = System.nanoTime();
		Throwable lastCause = null;
		Duration retryAfter = null;
		for (int attempt = 1; attempt <= properties.maxAttempts(); attempt++) {
			try {
				return requestMember(email, request);
			} catch (RetryableFinanceException exception) {
				lastCause = exception;
				retryAfter = exception.retryAfter();
			} catch (BusinessException exception) {
				throw exception;
			} catch (ResourceAccessException exception) {
				lastCause = exception;
				retryAfter = null;
			} catch (RestClientException exception) {
				lastCause = exception;
				retryAfter = null;
			}

			if (attempt < properties.maxAttempts()) {
				Duration delay = resolveRetryDelay(attempt, retryAfter);
				if (delay == null || exceedsRetryTimeLimit(startedAt, delay)) {
					break;
				}
				log.warn(
						"금융망 회원 조회 재시도: 다음 시도={}/{}, 대기={}ms, 오류 코드={}",
						attempt + 1,
						properties.maxAttempts(),
						delay.toMillis(),
						FinanceErrorCode.SERVICE_UNAVAILABLE.getCode()
				);
				waitBeforeRetry(delay);
			}
		}

		throw new BusinessException(FinanceErrorCode.SERVICE_UNAVAILABLE, lastCause);
	}

	private FinanceMember requestMember(
			String email,
			FinanceMemberSearchRequest request
	) {
		return financeRestClient.post()
				.uri(MEMBER_SEARCH_PATH)
				.contentType(MediaType.APPLICATION_JSON)
				.body(request)
				.exchange((httpRequest, response) -> parseResponse(email, response));
	}

	private void waitBeforeRetry(Duration delay) {
		try {
			Thread.sleep(delay);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new BusinessException(FinanceErrorCode.SERVICE_UNAVAILABLE, exception);
		}
	}

	private FinanceMember parseResponse(
			String requestedEmail,
			RestClient.RequestHeadersSpec.ConvertibleClientHttpResponse response
	) throws IOException {
		HttpStatusCode statusCode = response.getStatusCode();
		String body = response.bodyTo(String.class);
		if (RETRYABLE_STATUS_CODES.contains(statusCode.value())) {
			throw new RetryableFinanceException(parseRetryAfter(response.getHeaders().getFirst("Retry-After")));
		}

		JsonNode root = readResponseBody(body);
		String upstreamErrorCode = findUpstreamErrorCode(root);

		if (!statusCode.is2xxSuccessful() || upstreamErrorCode != null) {
			throw mapUpstreamError(upstreamErrorCode);
		}

		FinanceMemberSearchResponse searchResponse = convertSuccessResponse(root);
		validateSuccessResponse(requestedEmail, searchResponse);
		return new FinanceMember(searchResponse.userId(), searchResponse.userKey());
	}

	private JsonNode readResponseBody(String body) {
		if (body == null || body.isBlank()) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
		}

		try {
			return objectMapper.readTree(body);
		} catch (JacksonException exception) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE, exception);
		}
	}

	private FinanceMemberSearchResponse convertSuccessResponse(JsonNode root) {
		try {
			return objectMapper.treeToValue(root, FinanceMemberSearchResponse.class);
		} catch (JacksonException exception) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE, exception);
		}
	}

	private String findUpstreamErrorCode(JsonNode root) {
		String responseCode = textOrNull(root.path("responseCode"));
		if (responseCode == null) {
			responseCode = textOrNull(root.path("Header").path("responseCode"));
		}
		if (responseCode == null || "H0000".equals(responseCode)) {
			return null;
		}
		return responseCode;
	}

	private BusinessException mapUpstreamError(String responseCode) {
		if ("E4003".equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.MEMBER_NOT_FOUND);
		}
		if ("E4004".equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.CONFIGURATION_ERROR);
		}
		if ("Q1000".equals(responseCode)) {
			throw new RetryableFinanceException(null);
		}
		return new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
	}

	private Duration resolveRetryDelay(int failedAttempt, Duration retryAfter) {
		if (retryAfter != null) {
			return retryAfter.compareTo(properties.retryMaxDelay()) <= 0 ? retryAfter : null;
		}

		long multiplier = 1L << Math.min(failedAttempt - 1, 30);
		Duration exponentialDelay;
		try {
			exponentialDelay = properties.retryBaseDelay().multipliedBy(multiplier);
		} catch (ArithmeticException exception) {
			exponentialDelay = properties.retryMaxDelay();
		}
		Duration delayCap = exponentialDelay.compareTo(properties.retryMaxDelay()) < 0
				? exponentialDelay
				: properties.retryMaxDelay();
		long delayCapMillis = delayCap.toMillis();
		if (delayCapMillis <= 0) {
			return Duration.ZERO;
		}
		return Duration.ofMillis(ThreadLocalRandom.current().nextLong(delayCapMillis + 1));
	}

	private boolean exceedsRetryTimeLimit(long startedAt, Duration delay) {
		Duration elapsed = Duration.ofNanos(System.nanoTime() - startedAt);
		return elapsed.plus(delay).compareTo(properties.retryTimeLimit()) >= 0;
	}

	private Duration parseRetryAfter(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}

		try {
			long seconds = Long.parseLong(value.trim());
			return seconds < 0 ? null : Duration.ofSeconds(seconds);
		} catch (NumberFormatException ignored) {
			try {
				Instant retryAt = ZonedDateTime.parse(
						value.trim(),
						DateTimeFormatter.RFC_1123_DATE_TIME
				).toInstant();
				Duration delay = Duration.between(Instant.now(), retryAt);
				return delay.isNegative() ? Duration.ZERO : delay;
			} catch (DateTimeParseException exception) {
				return null;
			}
		}
	}

	private void validateSuccessResponse(
			String requestedEmail,
			FinanceMemberSearchResponse response
	) {
		if (response == null
				|| !requestedEmail.equals(response.userId())
				|| response.userKey() == null
				|| response.userKey().isBlank()
				|| response.userKey().length() > MAX_USER_KEY_LENGTH) {
			throw new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
		}
	}

	private String textOrNull(JsonNode node) {
		if (node.isMissingNode() || node.isNull() || !node.isTextual() || node.asText().isBlank()) {
			return null;
		}
		return node.asText();
	}

	private void validateEmail(String email) {
		if (email == null || email.isBlank()) {
			throw new IllegalArgumentException("금융망 조회 이메일은 비어 있을 수 없습니다.");
		}
	}

	private static final class RetryableFinanceException extends RuntimeException {

		private final Duration retryAfter;

		private RetryableFinanceException(Duration retryAfter) {
			this.retryAfter = retryAfter;
		}

		private Duration retryAfter() {
			return retryAfter;
		}
	}
}
