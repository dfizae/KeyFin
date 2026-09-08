package com.finset.key_fin.global.exception;

import com.finset.key_fin.global.base.BaseResponse;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	@ExceptionHandler(BusinessException.class)
	public ResponseEntity<BaseResponse<Void>> handleBusinessException(BusinessException exception) {
		ErrorCode errorCode = exception.getErrorCode();

		if (errorCode.getHttpStatus().is5xxServerError()) {
			log.error("Business failure: code={}", errorCode.getCode(), exception);
		} else {
			log.warn("Business failure: code={}", errorCode.getCode());
		}

		return ResponseEntity.status(errorCode.getHttpStatus())
				.body(BaseResponse.fail(errorCode.getCode(), errorCode.getMessage()));
	}

	@Override
	protected @Nullable ResponseEntity<Object> handleExceptionInternal(
			Exception exception,
			@Nullable Object body,
			HttpHeaders headers,
			HttpStatusCode statusCode,
			WebRequest request
	) {
		if (statusCode.is5xxServerError()) {
			log.error("MVC failure: status={}", statusCode.value(), exception);
		}

		// Spring MVC가 정한 상태와 헤더, 이미 전송된 응답에 대한 처리를 유지한다.
		return super.handleExceptionInternal(
				exception, toBody(statusCode), headers, statusCode, request
		);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<BaseResponse<Void>> handleUnexpectedException(Exception exception) {
		log.error("Unhandled exception", exception);

		return ResponseEntity.internalServerError()
				.body(toBody(HttpStatus.INTERNAL_SERVER_ERROR));
	}

	private BaseResponse<Void> toBody(HttpStatusCode statusCode) {
		String message = statusCode.is5xxServerError()
				? "서버 내부 오류가 발생했습니다."
				: "요청을 처리할 수 없습니다.";
		return BaseResponse.fail("HTTP_" + statusCode.value(), message);
	}
}
