package com.finset.key_fin.coaching.exception;

import org.springframework.http.HttpStatus;

import com.finset.key_fin.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum CoachingErrorCode implements ErrorCode {

	COACHING_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "AI_001", "코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요."),
	CHART_NOT_FOUND(HttpStatus.NOT_FOUND, "AI_002", "차트를 찾을 수 없어요.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
