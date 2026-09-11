package com.finset.key_fin.support;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class FixedClockConfig {

	public static final Instant NOW = Instant.parse("2026-09-10T03:00:00Z");

	@Bean
	@Primary
	Clock fixedClock() {
		return Clock.fixed(NOW, ZoneId.of("Asia/Seoul"));
	}
}
