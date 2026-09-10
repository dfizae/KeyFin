package com.finset.key_fin.finance.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class FinanceClientConfigTest {

	@Test
	void createsFinanceRestClient() {
		FinanceProperties properties = new FinanceProperties(
				URI.create("https://finopenapi.ssafy.io"),
				"finance-api-key",
				Duration.ofSeconds(3),
				Duration.ofSeconds(5)
		);

		RestClient restClient = new FinanceClientConfig()
				.financeRestClient(properties);

		assertThat(restClient).isNotNull();
	}
}
