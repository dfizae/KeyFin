package com.finset.key_fin.room.exception;

import com.finset.key_fin.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum RoomErrorCode implements ErrorCode {
	NOT_STICKER_TARGET(HttpStatus.BAD_REQUEST, "ROOM_001", "기본 가구에 부착된 딱지만 제거할 수 있습니다."),
	ALREADY_REMOVED_TODAY(HttpStatus.CONFLICT, "ROOM_002", "오늘은 이미 압류 딱지를 제거했습니다."),
	STICKER_NOT_ATTACHED(HttpStatus.CONFLICT, "ROOM_003", "해당 가구에 부착된 압류 딱지가 없습니다.");

	private final HttpStatus httpStatus;
	private final String code;
	private final String message;
}
