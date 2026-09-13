package com.finset.key_fin.payment.exception;

import org.springframework.http.HttpStatus;

import com.finset.key_fin.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PaymentErrorCode implements ErrorCode {

	FIXED_EXPENSE_NOT_FOUND(HttpStatus.NOT_FOUND, "PAY_001", "고정지출을 찾을 수 없습니다."),
	FIXED_EXPENSE_SYNCED(HttpStatus.CONFLICT, "PAY_002",
			"금융망에서 동기화된 항목은 KeyFin에서 변경할 수 없습니다. 카드사·서비스에서 변경하면 다음 동기화에 반영됩니다."),
	FIXED_EXPENSE_DUPLICATED(HttpStatus.CONFLICT, "PAY_003", "같은 내용의 고정지출이 이미 등록되어 있습니다."),
	EXPENSE_TYPE_NOT_MANUAL(HttpStatus.BAD_REQUEST, "PAY_004", "카드 청구는 직접 등록할 수 없습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
