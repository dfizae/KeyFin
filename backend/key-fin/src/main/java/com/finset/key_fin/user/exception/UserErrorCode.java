package com.finset.key_fin.user.exception;

import com.finset.key_fin.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum UserErrorCode implements ErrorCode {

	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_001", "사용자를 찾을 수 없습니다."),
	DUPLICATE_EMAIL(HttpStatus.CONFLICT, "USER_002", "이미 사용 중인 이메일입니다."),
	DELETED_USER(HttpStatus.CONFLICT, "USER_003", "탈퇴한 이메일은 다시 가입할 수 없습니다."),
	FINANCE_CONNECTION_CONFLICT(HttpStatus.CONFLICT, "USER_004", "이미 다른 금융망 사용자와 연결되어 있습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
