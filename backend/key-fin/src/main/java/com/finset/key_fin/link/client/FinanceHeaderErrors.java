package com.finset.key_fin.link.client;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.exception.FinanceErrorCode;

final class FinanceHeaderErrors {

	private static final String USER_KEY_INVALID = "H1009";
	private static final String API_KEY_INVALID = "H1008";
	private static final String TRANSACTION_NO_DUPLICATED = "H1007";
	private static final String UNKNOWN_ERROR = "Q1000";

	private FinanceHeaderErrors() {
	}

	static RuntimeException map(String responseCode) {
		if (USER_KEY_INVALID.equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.USER_KEY_INVALID);
		}
		if (API_KEY_INVALID.equals(responseCode)) {
			return new BusinessException(FinanceErrorCode.CONFIGURATION_ERROR);
		}
		if (TRANSACTION_NO_DUPLICATED.equals(responseCode) || UNKNOWN_ERROR.equals(responseCode)) {
			return new RetryableFinanceException(null);
		}
		return new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
	}
}
