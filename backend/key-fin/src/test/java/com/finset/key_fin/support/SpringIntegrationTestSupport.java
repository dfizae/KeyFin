package com.finset.key_fin.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;

@SpringBootTest
public abstract class SpringIntegrationTestSupport {

	public static final String FINANCE_BASE_URL = "https://finance.test/finance/api/v1";
	public static final String FINANCE_API_KEY = "integration-test-api-key";

	@DynamicPropertySource
	static void registerInfrastructure(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", () -> Containers.MYSQL.getJdbcUrl()
				+ "?serverTimezone=Asia/Seoul&characterEncoding=UTF-8");
		registry.add("spring.datasource.username", Containers.MYSQL::getUsername);
		registry.add("spring.datasource.password", Containers.MYSQL::getPassword);
		registry.add("spring.data.redis.host", Containers.REDIS::getHost);
		registry.add("spring.data.redis.port", () -> Containers.REDIS.getMappedPort(6379));
		registry.add("jwt.secret", () -> "integration-test-jwt-secret-0123456789abcdef0123456789abcdef");
		registry.add("finance.api.base-url", () -> FINANCE_BASE_URL);
		registry.add("finance.api.api-key", () -> FINANCE_API_KEY);
	}

	private static final class Containers {
		private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
				.withDatabaseName("keyfin")
				.withUsername("keyfin")
				.withPassword("keyfin")
				.withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci",
						"--default-time-zone=+09:00");

		private static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
				.withExposedPorts(6379);

		static {
			// Keep containers alive for cached Spring contexts across test classes.
			// Ryuk cleans them up when the test JVM exits; do not add @Container here.
			MYSQL.start();
			REDIS.start();
		}
	}
}
