package com.finset.key_fin.global.finance.client;

import com.finset.key_fin.global.finance.config.FinanceProperties;
import com.finset.key_fin.global.finance.dto.request.FinanceRequestHeader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class FinanceHeaderFactory {

	static final String INSTITUTION_CODE = "00100";
	static final String FINTECH_APP_NO = "001";
	private static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
	private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HHmmss");
	private static final int SEQUENCE_BOUND = 1_000_000;

	private final FinanceProperties properties;
	private final Clock clock;

	@Autowired
	public FinanceHeaderFactory(FinanceProperties properties) {
		this(properties, Clock.system(KST));
	}

	public FinanceHeaderFactory(FinanceProperties properties, Clock clock) {
		this.properties = properties;
		this.clock = clock.withZone(KST);
	}

	public FinanceRequestHeader create(String apiName, String userKey) {
		requireText(apiName, "금융망 API 이름");
		requireText(userKey, "금융망 사용자 키");

		LocalDateTime now = LocalDateTime.now(clock);
		String transmissionDate = DATE_FORMAT.format(now);
		String transmissionTime = TIME_FORMAT.format(now);

		return new FinanceRequestHeader(
				apiName,
				transmissionDate,
				transmissionTime,
				INSTITUTION_CODE,
				FINTECH_APP_NO,
				apiName,
				newTransactionUniqueNo(transmissionDate, transmissionTime),
				properties.apiKey(),
				userKey
		);
	}

	private String newTransactionUniqueNo(String transmissionDate, String transmissionTime) {
		int sequence = ThreadLocalRandom.current().nextInt(SEQUENCE_BOUND);
		return transmissionDate + transmissionTime + String.format("%06d", sequence);
	}

	private static void requireText(String value, String name) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(name + "은 비어 있을 수 없습니다.");
		}
	}
}
