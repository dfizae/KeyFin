package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum CoachingErrorCode implements ErrorCode {
    UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "COACHING_UNAVAILABLE", "AI 코칭 연결이 아직 준비되지 않았습니다."),
    TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "COACHING_TIMEOUT", "답변 시간이 초과됐습니다. 같은 요청으로 다시 시도해 주세요."),
    UPSTREAM(HttpStatus.BAD_GATEWAY, "COACHING_UPSTREAM", "AI 코칭 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요."),
    INVALID_REQUEST(HttpStatus.UNPROCESSABLE_ENTITY, "COACHING_INVALID_REQUEST", "질문이나 조회 기간을 확인해 주세요."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "COACHING_NOT_FOUND", "이 사용자의 대화 또는 답변을 찾을 수 없습니다."),
    CONFLICT(HttpStatus.CONFLICT, "COACHING_CONFLICT", "이 요청은 다른 내용으로 이미 처리되었습니다."),
    TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS, "COACHING_BUSY", "AI 코칭 요청이 많습니다. 잠시 후 다시 시도해 주세요."),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "COACHING_AUTH_REQUIRED", "로그인한 뒤 이용해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
