package com.finset.key_fin.link.client;

import java.time.Duration;

final class RetryableFinanceException extends RuntimeException {

	private final transient Duration retryAfter;

	RetryableFinanceException(Duration retryAfter) {
		super("금융망 일시 장애 응답");
		this.retryAfter = retryAfter;
	}

	Duration retryAfter() {
		return retryAfter;
	}
}
