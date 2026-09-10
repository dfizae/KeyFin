package com.finset.key_fin.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
		"jwt.secret=integration-test-jwt-secret-0123456789abcdef0123456789abcdef",
		"finance.api.base-url=" + IntegrationTestSupport.FINANCE_BASE_URL,
		"finance.api.api-key=" + IntegrationTestSupport.FINANCE_API_KEY,
		"finance.api.max-attempts=3",
		"finance.api.retry-base-delay=0ms",
		"finance.api.retry-max-delay=0ms",
		"finance.api.retry-time-limit=5s"
})
@AutoConfigureMockMvc
@Testcontainers
@Import(FinanceMockServerConfig.class)
public abstract class IntegrationTestSupport {

	public static final String FINANCE_BASE_URL = "https://finance.test/finance/api/v1";
	public static final String FINANCE_API_KEY = "integration-test-api-key";

	@Container
	static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
			.withDatabaseName("keyfin")
			.withUsername("keyfin")
			.withPassword("keyfin")
			.withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci", "--default-time-zone=+09:00");

	@Container
	static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
			.withExposedPorts(6379);

	@DynamicPropertySource
	static void registerInfrastructure(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", () -> MYSQL.getJdbcUrl() + "?serverTimezone=Asia/Seoul&characterEncoding=UTF-8");
		registry.add("spring.datasource.username", MYSQL::getUsername);
		registry.add("spring.datasource.password", MYSQL::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
	}
}
