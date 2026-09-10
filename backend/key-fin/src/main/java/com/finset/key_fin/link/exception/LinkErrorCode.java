package com.finset.key_fin.link.exception;

import com.finset.key_fin.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum LinkErrorCode implements ErrorCode {

	FINANCE_MEMBER_ALREADY_LINKED(
			HttpStatus.CONFLICT,
			"LINK_001",
			"해당 금융망 사용자는 이미 다른 계정과 연결되어 있습니다."
	);

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
