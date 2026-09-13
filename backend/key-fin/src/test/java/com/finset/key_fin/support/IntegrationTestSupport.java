package com.finset.key_fin.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

@SpringBootTest(properties = {
		"finance.api.max-attempts=3",
		"finance.api.retry-base-delay=0ms",
		"finance.api.retry-max-delay=0ms",
		"finance.api.retry-time-limit=5s"
})
@AutoConfigureMockMvc
@Import(FinanceMockServerConfig.class)
public abstract class IntegrationTestSupport extends SpringIntegrationTestSupport {
}
