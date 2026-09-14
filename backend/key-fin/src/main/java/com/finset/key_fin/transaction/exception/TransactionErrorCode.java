package com.finset.key_fin.transaction.exception;

import com.finset.key_fin.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum TransactionErrorCode implements ErrorCode {

	INVALID_MONTH(HttpStatus.BAD_REQUEST, "TRANSACTION_001", "조회 월 형식이 올바르지 않습니다."),
	INVALID_PAGE_SIZE(HttpStatus.BAD_REQUEST, "TRANSACTION_002", "페이지 크기는 1 이상 100 이하여야 합니다."),
	INVALID_SEARCH_FILTER(HttpStatus.BAD_REQUEST, "TRANSACTION_003", "거래 조회 조건이 올바르지 않습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
