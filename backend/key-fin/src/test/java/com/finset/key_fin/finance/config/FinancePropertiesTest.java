package com.finset.key_fin.finance.config;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class FinancePropertiesTest {

	private static final URI BASE_URL = URI.create("https://finopenapi.ssafy.io");
	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
	private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

	@Test
	void createsFinanceProperties() {
		FinanceProperties properties = new FinanceProperties(
				BASE_URL,
				"finance-api-key",
				CONNECT_TIMEOUT,
				READ_TIMEOUT
		);

		assertThat(properties.baseUrl()).isEqualTo(BASE_URL);
		assertThat(properties.apiKey()).isEqualTo("finance-api-key");
		assertThat(properties.connectTimeout()).isEqualTo(CONNECT_TIMEOUT);
		assertThat(properties.readTimeout()).isEqualTo(READ_TIMEOUT);
		assertThat(properties.toString())
				.doesNotContain("finance-api-key")
				.contains("apiKey=******");
	}

	@Test
	void rejectsRelativeBaseUrl() {
		assertThatIllegalArgumentException().isThrownBy(() -> new FinanceProperties(
				URI.create("/ssafy"),
				"finance-api-key",
				CONNECT_TIMEOUT,
				READ_TIMEOUT
		));
	}

	@Test
	void rejectsBlankApiKey() {
		assertThatIllegalArgumentException().isThrownBy(() -> new FinanceProperties(
				BASE_URL,
				" ",
				CONNECT_TIMEOUT,
				READ_TIMEOUT
		));
	}

	@Test
	void rejectsNonPositiveTimeout() {
		assertThatIllegalArgumentException().isThrownBy(() -> new FinanceProperties(
				BASE_URL,
				"finance-api-key",
				Duration.ZERO,
				READ_TIMEOUT
		));
	}
}
