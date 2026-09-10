package com.finset.key_fin.link.client;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.config.FinanceProperties;
import com.finset.key_fin.link.dto.request.FinanceMemberSearchRequest;
import com.finset.key_fin.link.dto.response.FinanceMember;
import com.finset.key_fin.link.dto.response.FinanceMemberSearchResponse;
import com.finset.key_fin.link.exception.FinanceErrorCode;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

@Component
public class FinanceMemberRestClient implements FinanceMemberClient {

	private static final String MEMBER_SEARCH_PATH = "/member/search";
	private static final int MAX_USER_KEY_LENGTH = 60;

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

		try {
			return financeRestClient.post()
					.uri(MEMBER_SEARCH_PATH)
					.contentType(MediaType.APPLICATION_JSON)
					.body(request)
					.exchange((httpRequest, response) -> parseResponse(email, response));
		} catch (BusinessException exception) {
			throw exception;
		} catch (ResourceAccessException exception) {
			throw new BusinessException(FinanceErrorCode.SERVICE_UNAVAILABLE, exception);
		} catch (RestClientException exception) {
			throw new BusinessException(FinanceErrorCode.SERVICE_UNAVAILABLE, exception);
		}
	}

	private FinanceMember parseResponse(
			String requestedEmail,
			RestClient.RequestHeadersSpec.ConvertibleClientHttpResponse response
	) throws IOException {
		String body = response.bodyTo(String.class);
		JsonNode root = readResponseBody(body);
		String upstreamErrorCode = findUpstreamErrorCode(root);

		if (!response.getStatusCode().is2xxSuccessful() || upstreamErrorCode != null) {
			throw mapUpstreamError(upstreamErrorCode, response.getStatusCode().is5xxServerError());
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

	private BusinessException mapUpstreamError(String responseCode, boolean serverError) {
		if ("E4003".equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.MEMBER_NOT_FOUND);
		}
		if ("E4004".equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.CONFIGURATION_ERROR);
		}
		if (serverError || "Q1000".equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.SERVICE_UNAVAILABLE);
		}
		return new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
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
}
