package com.finset.key_fin.budget.exception;

import org.springframework.http.HttpStatus;

import com.finset.key_fin.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum BudgetErrorCode implements ErrorCode {

	BUDGET_ALREADY_EXISTS(HttpStatus.CONFLICT, "BUDGET_001", "해당 월의 예산이 이미 존재합니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
