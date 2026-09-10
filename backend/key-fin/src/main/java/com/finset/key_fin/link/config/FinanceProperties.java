package com.finset.key_fin.link.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.time.Duration;
import java.util.Set;

@ConfigurationProperties(prefix = "finance.api")
public record FinanceProperties(
		URI baseUrl,
		String apiKey,
		Duration connectTimeout,
		Duration readTimeout
) {

	private static final Set<String> SUPPORTED_SCHEMES = Set.of("http", "https");

	public FinanceProperties {
		validateBaseUrl(baseUrl);
		if (apiKey == null || apiKey.isBlank()) {
			throw new IllegalArgumentException("금융망 API Key는 비어 있을 수 없습니다.");
		}
		validateTimeout(connectTimeout, "금융망 연결 Timeout");
		validateTimeout(readTimeout, "금융망 응답 Timeout");
	}

	private static void validateBaseUrl(URI baseUrl) {
		if (baseUrl == null || !baseUrl.isAbsolute() || !SUPPORTED_SCHEMES.contains(baseUrl.getScheme())) {
			throw new IllegalArgumentException("금융망 Base URL은 HTTP 또는 HTTPS 절대 주소여야 합니다.");
		}
	}

	private static void validateTimeout(Duration timeout, String name) {
		if (timeout == null || timeout.isZero() || timeout.isNegative()) {
			throw new IllegalArgumentException(name + "은 0보다 커야 합니다.");
		}
	}

	@Override
	public String toString() {
		return "FinanceProperties[baseUrl=" + baseUrl
				+ ", apiKey=******"
				+ ", connectTimeout=" + connectTimeout
				+ ", readTimeout=" + readTimeout + "]";
	}
}
